const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fileHandler = require('../services/fileHandler');
const fs = require('fs');
const path = require('path');

// In-memory task store
const tasks = new Map();

// Task statuses
const TaskStatus = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed'
};

/**
 * POST /api/convert/start - Start a conversion task
 */
router.post('/start', async (req, res) => {
    try {
        const { files, model } = req.body;

        if (!files || files.length === 0) {
            return res.status(400).json({
                error: 'Dosya listesi boş',
                errorKey: 'errors.noFile'
            });
        }

        // Create task
        const taskId = crypto.randomUUID();
        const task = {
            id: taskId,
            status: TaskStatus.PENDING,
            markdown: '',
            progress: 0,
            error: null,
            createdAt: Date.now(),
            files: files.map(f => f.filename).join(', ')
        };

        tasks.set(taskId, task);

        console.log(`🚀 Task başlatıldı: ${taskId} (${files.length} dosya)`);

        // Start processing in background
        processTask(taskId, files, model || 'gemini-3-flash-preview');

        res.json({
            success: true,
            taskId,
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

/**
 * GET /api/convert/status/:taskId - Get task status
 */
router.get('/status/:taskId', (req, res) => {
    const { taskId } = req.params;
    const task = tasks.get(taskId);

    if (!task) {
        return res.status(404).json({
            error: 'Task bulunamadı',
            errorKey: 'errors.taskNotFound'
        });
    }

    res.json({
        taskId: task.id,
        status: task.status,
        markdown: task.markdown,
        progress: task.progress,
        eta: task.eta,
        tps: task.tps,
        error: task.error
    });
});

/**
 * Process task in background
 */
async function processTask(taskId, files, model) {
    const task = tasks.get(taskId);
    if (!task) return;

    try {
        task.status = TaskStatus.PROCESSING;
        task.progress = 10;

        // Read files from cache
        const CACHE_DIR = path.join(__dirname, '../../public/cache');
        const fileBuffers = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const filePath = path.join(CACHE_DIR, path.basename(file.url));

            if (fs.existsSync(filePath)) {
                const buffer = fs.readFileSync(filePath);
                fileBuffers.push({
                    buffer,
                    originalname: file.filename,
                    mimetype: file.mimetype
                });
            } else {
                throw new Error(`Dosya bulunamadı: ${file.filename}`);
            }

            task.progress = 10 + Math.floor((i + 1) / files.length * 20);
        }

        task.progress = 30;

        // Encoding progress callback (30% → 60%)
        const onEncodingProgress = (progressData) => {
            if (progressData.type === 'encoding' && progressData.percent) {
                // Map encoding progress to 30-60% range
                task.progress = 30 + Math.floor(progressData.percent * 0.3);
                task.eta = progressData.eta;
            }
        };

        // AI streaming callback (60% → 90%)
        let streamStartTime = Date.now();
        let totalTokens = 0;
        let lastUpdateTime = Date.now();

        const onStreamChunk = (chunk) => {
            task.markdown += chunk;
            totalTokens += chunk.length / 4; // Rough token estimate

            const now = Date.now();
            if (now - lastUpdateTime >= 1000) { // Update every 1 second
                lastUpdateTime = now;

                const elapsed = (now - streamStartTime) / 1000;
                const tps = elapsed > 0 ? (totalTokens / elapsed).toFixed(1) : '0.0';

                // Progress 60% → 90% based on content length (artificial)
                if (task.progress < 90) {
                    task.progress = Math.min(90, 60 + Math.floor(totalTokens / 100));
                }

                task.tps = tps;
            }
        };

        // Process files with Gemini
        const markdown = await fileHandler.processMultipleFiles(
            fileBuffers,
            model,
            onStreamChunk,
            onEncodingProgress
        );

        task.markdown = markdown;
        task.progress = 100;
        task.status = TaskStatus.COMPLETED;
        delete task.eta;
        delete task.tps;

        console.log(`✅ Task tamamlandı: ${taskId}`);

    } catch (error) {
        console.error(`❌ Task hatası (${taskId}):`, error.message);
        task.status = TaskStatus.FAILED;
        task.error = error.message;
        delete task.eta;
        delete task.tps;
    }

    // Clean up task after 30 minutes
    setTimeout(() => {
        tasks.delete(taskId);
    }, 30 * 60 * 1000);
}

module.exports = router;
