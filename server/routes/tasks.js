const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fileHandler = require('../services/fileHandler');
const mediaEncoder = require('../services/mediaEncoder');
const fs = require('fs');
const path = require('path');

const tasks = new Map();

const TaskStatus = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
};

function createTask(files) {
    const now = Date.now();
    return {
        id: crypto.randomUUID(),
        status: TaskStatus.PENDING,
        phase: 'queued',
        message: 'Sıraya alındı',
        markdown: '',
        progress: 0,
        mediaProgress: null,
        currentFile: null,
        error: null,
        createdAt: now,
        startedAt: null,
        phaseStartedAt: now,
        estimatedTotalSeconds: null,
        etaSeconds: null,
        aiProgress: null,
        aiStartedAt: null,
        aiChars: 0,
        files: files.map(f => f.filename).join(', '),
        abortController: new AbortController(),
        ffmpegProcess: null
    };
}

function setPhase(task, phase, patch = {}) {
    if (task.phase !== phase) {
        task.phaseStartedAt = Date.now();
    }
    updateTask(task, { phase, ...patch });
}

function calculateEta(task) {
    if (task.status !== TaskStatus.PROCESSING) return null;

    if (Number.isFinite(task.etaSeconds)) {
        return Math.max(0, Math.ceil(task.etaSeconds));
    }

    const start = task.startedAt || task.createdAt;
    const elapsed = Math.max((Date.now() - start) / 1000, 1);
    const progress = Math.max(task.progress || 0, 1);
    if (progress >= 100) return 0;
    return Math.max(0, Math.ceil((elapsed / progress) * (100 - progress)));
}

function sanitizeTask(task) {
    return {
        taskId: task.id,
        status: task.status,
        phase: task.phase,
        message: task.message,
        markdown: task.markdown,
        progress: task.progress,
        mediaProgress: task.mediaProgress,
        currentFile: task.currentFile,
        error: task.error,
        startedAt: task.startedAt,
        phaseStartedAt: task.phaseStartedAt,
        estimatedTotalSeconds: task.estimatedTotalSeconds,
        etaSeconds: calculateEta(task),
        aiProgress: task.aiProgress
    };
}

function updateTask(task, patch) {
    Object.assign(task, patch);
}

function assertNotCancelled(task) {
    if (task.abortController.signal.aborted || task.status === TaskStatus.CANCELLED) {
        throw new Error('Dönüştürme işlemi iptal edildi.');
    }
}

router.post('/start', async (req, res) => {
    try {
        const { files, model } = req.body;

        if (!files || files.length === 0) {
            return res.status(400).json({
                error: 'Dosya listesi boş',
                errorKey: 'errors.noFile'
            });
        }

        const task = createTask(files);
        tasks.set(task.id, task);

        console.log(`🚀 Task başlatıldı: ${task.id} (${files.length} dosya)`);
        processTask(task.id, files, model || 'gpt-4o');

        res.json({
            success: true,
            taskId: task.id,
            status: task.status
        });
    } catch (error) {
        console.error('Task başlatma hatası:', error.message);
        res.status(500).json({
            error: error.message,
            errorKey: 'errors.taskStartFailed'
        });
    }
});

router.get('/status/:taskId', (req, res) => {
    const task = tasks.get(req.params.taskId);
    if (!task) {
        return res.status(404).json({
            error: 'Task bulunamadı',
            errorKey: 'errors.taskNotFound'
        });
    }
    res.json(sanitizeTask(task));
});

router.post('/cancel/:taskId', (req, res) => {
    const task = tasks.get(req.params.taskId);
    if (!task) {
        return res.status(404).json({
            error: 'Task bulunamadı',
            errorKey: 'errors.taskNotFound'
        });
    }

    if (![TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED].includes(task.status)) {
        task.abortController.abort();
        if (task.ffmpegProcess) {
            mediaEncoder.killProcess(task.ffmpegProcess);
        }
        updateTask(task, {
            status: TaskStatus.CANCELLED,
            phase: 'cancelled',
            message: 'İşlem iptal edildi',
            error: 'İşlem iptal edildi'
        });
        console.log(`🛑 Task iptal edildi: ${task.id}`);
    }

    res.json({ success: true, ...sanitizeTask(task) });
});

router.delete('/status/:taskId', (req, res) => {
    const task = tasks.get(req.params.taskId);
    if (!task) {
        return res.status(404).json({
            error: 'Task bulunamadı',
            errorKey: 'errors.taskNotFound'
        });
    }

    if (![TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED].includes(task.status)) {
        task.abortController.abort();
        if (task.ffmpegProcess) {
            mediaEncoder.killProcess(task.ffmpegProcess);
        }
        updateTask(task, {
            status: TaskStatus.CANCELLED,
            phase: 'cancelled',
            message: 'İşlem iptal edildi',
            error: 'İşlem iptal edildi'
        });
        console.log(`🛑 Task iptal edildi: ${task.id}`);
    }

    res.json({ success: true, ...sanitizeTask(task) });
});

async function downloadRemoteFile(file, task) {
    const https = require('https');
    const http = require('http');

    let downloadUrl = file.url;
    if (downloadUrl.startsWith('/')) {
        const port = process.env.PORT || 3000;
        downloadUrl = `http://localhost:${port}${downloadUrl}`;
    }

    updateTask(task, {
        phase: 'fetching',
        message: `Dosya indiriliyor: ${file.filename}`,
        currentFile: file.filename
    });

    return new Promise((resolve, reject) => {
        const protocol = downloadUrl.startsWith('https') ? https : http;
        const request = protocol.get(downloadUrl, (response) => {
            if (response.statusCode && response.statusCode >= 400) {
                reject(new Error(`Dosya indirilemedi: HTTP ${response.statusCode}`));
                return;
            }
            const chunks = [];
            response.on('data', chunk => {
                assertNotCancelled(task);
                chunks.push(chunk);
            });
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
        });
        task.abortController.signal.addEventListener('abort', () => {
            request.destroy(new Error('İndirme iptal edildi.'));
        }, { once: true });
        request.on('error', reject);
    });
}

async function buildFileInputs(task, files) {
    const CACHE_DIR = path.join(__dirname, '../../public/cache');
    const fileInputs = [];

    for (let i = 0; i < files.length; i++) {
        assertNotCancelled(task);
        const file = files[i];
        const baseProgress = 5 + Math.floor((i / files.length) * 20);
        updateTask(task, {
            progress: baseProgress,
            phase: 'loading',
            message: `Dosya hazırlanıyor: ${file.filename}`,
            currentFile: file.filename,
            mediaProgress: null
        });

        const isS3 = file.storage === 's3' || (file.url && file.url.startsWith('/api/files/'));
        if (isS3 && file.url) {
            const buffer = await downloadRemoteFile(file, task);
            fileInputs.push({
                buffer,
                originalname: file.filename,
                mimetype: file.mimetype
            });
        } else {
            const filePath = path.join(CACHE_DIR, path.basename(file.url));
            if (!fs.existsSync(filePath)) {
                throw new Error(`Dosya bulunamadı: ${file.filename}`);
            }
            fileInputs.push({
                path: filePath,
                buffer: null,
                originalname: file.filename,
                mimetype: file.mimetype
            });
        }

        task.progress = 5 + Math.floor(((i + 1) / files.length) * 20);
    }

    return fileInputs;
}

async function processTask(taskId, files, model) {
    const task = tasks.get(taskId);
    if (!task) return;

    try {
        setPhase(task, 'loading', {
            status: TaskStatus.PROCESSING,
            message: 'Dosyalar okunuyor',
            progress: 5,
            startedAt: Date.now(),
            estimatedTotalSeconds: 75,
            etaSeconds: 70
        });

        const fileInputs = await buildFileInputs(task, files);
        assertNotCancelled(task);

        setPhase(task, 'preparing', {
            progress: 25,
            message: 'Medya ve dokümanlar hazırlanıyor',
            currentFile: null,
            etaSeconds: 60
        });

        const markdown = await fileHandler.processMultipleFiles(fileInputs, model, (chunk) => {
            assertNotCancelled(task);
            task.markdown += chunk;

            const elapsedAiSeconds = Math.max((Date.now() - (task.aiStartedAt || Date.now())) / 1000, 0);
            const charProgress = Math.min(task.markdown.length / 10000, 1);
            const timeProgress = Math.min(elapsedAiSeconds / 60, 1);
            const blendedAiProgress = Math.max(charProgress * 0.55 + timeProgress * 0.45, task.aiProgress?.fraction || 0);
            const boundedAiProgress = Math.min(blendedAiProgress, 0.98);
            const progress = Math.min(99, Math.floor(80 + boundedAiProgress * 19));
            const remainingByTime = Math.max(0, 60 - elapsedAiSeconds);
            const remainingByChars = task.markdown.length > 0
                ? Math.max(0, ((10000 - task.markdown.length) / Math.max(task.markdown.length, 1)) * elapsedAiSeconds)
                : remainingByTime;

            task.progress = Math.max(task.progress, progress);
            task.etaSeconds = Math.ceil(Math.min(Math.max(remainingByTime, 5), Math.max(remainingByChars, 5), 60));
            task.aiProgress = {
                fraction: boundedAiProgress,
                percent: Math.round(boundedAiProgress * 100),
                elapsedSeconds: Math.round(elapsedAiSeconds),
                etaSeconds: task.etaSeconds,
                chars: task.markdown.length,
                expectedChars: 10000
            };
        }, {}, {
            signal: task.abortController.signal,
            onFileStart: ({ file, index, total }) => {
                setPhase(task, 'preparing', {
                    currentFile: file.originalname,
                    message: `Dosya işleniyor (${index + 1}/${total}): ${file.originalname}`,
                    progress: 25 + Math.floor((index / total) * 35),
                    mediaProgress: null,
                    etaSeconds: 60
                });
            },
            onMediaProgress: (progress) => {
                const mediaPercent = progress.percent || 0;
                const elapsedPhaseSeconds = Math.max((Date.now() - task.phaseStartedAt) / 1000, 1);
                const mediaEta = mediaPercent > 0 ? Math.ceil((elapsedPhaseSeconds / mediaPercent) * (100 - mediaPercent)) : null;
                setPhase(task, 'media-encoding', {
                    message: `FFmpeg ile MP3'e dönüştürülüyor (${mediaPercent}%)`,
                    progress: Math.min(80, 30 + Math.floor(mediaPercent * 0.45)),
                    mediaProgress: {
                        ...progress,
                        etaSeconds: mediaEta,
                        elapsedSeconds: Math.round(elapsedPhaseSeconds)
                    },
                    etaSeconds: mediaEta
                });
            },
            registerProcess: (child) => {
                task.ffmpegProcess = child;
            },
            onAiStart: () => {
                setPhase(task, 'ai-conversion', {
                    message: 'AI ile metinleştiriliyor',
                    progress: Math.max(task.progress, 80),
                    mediaProgress: null,
                    ffmpegProcess: null,
                    aiStartedAt: Date.now(),
                    aiProgress: { fraction: 0, percent: 0, elapsedSeconds: 0, etaSeconds: 60, chars: 0, expectedChars: 10000 },
                    etaSeconds: 60
                });
            }
        });

        assertNotCancelled(task);
        updateTask(task, {
            markdown,
            progress: 100,
            status: TaskStatus.COMPLETED,
            phase: 'completed',
            message: 'Dönüştürme tamamlandı',
            currentFile: null,
            mediaProgress: null,
            ffmpegProcess: null
        });

        console.log(`✅ Task tamamlandı: ${taskId}`);
    } catch (error) {
        const wasCancelled = task.abortController.signal.aborted || task.status === TaskStatus.CANCELLED || error.message.includes('iptal');
        console.error(`${wasCancelled ? '🛑' : '❌'} Task ${wasCancelled ? 'iptal' : 'hata'} (${taskId}):`, error.message);
        updateTask(task, {
            status: wasCancelled ? TaskStatus.CANCELLED : TaskStatus.FAILED,
            phase: wasCancelled ? 'cancelled' : 'failed',
            message: wasCancelled ? 'İşlem iptal edildi' : 'Dönüştürme başarısız',
            error: error.message,
            ffmpegProcess: null
        });
    }

    setTimeout(() => {
        tasks.delete(taskId);
    }, 30 * 60 * 1000);
}

module.exports = router;
