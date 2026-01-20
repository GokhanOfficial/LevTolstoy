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

        // Process files with Gemini
        const markdown = await fileHandler.processMultipleFiles(fileBuffers, model, (progress) => {
            // Progress callback
            task.progress = 30 + Math.floor(progress * 0.6);
            task.markdown = fileHandler.getPartialResult?.() || task.markdown;
        });

        task.markdown = markdown;
        task.progress = 100;
        task.status = TaskStatus.COMPLETED;

        console.log(`✅ Task tamamlandı: ${taskId}`);

    } catch (error) {
        console.error(`❌ Task hatası (${taskId}):`, error.message);
        task.status = TaskStatus.FAILED;
        task.error = error.message;
    }

    // Clean up task after 30 minutes
    setTimeout(() => {
        tasks.delete(taskId);
    }, 30 * 60 * 1000);
}

module.exports = router;
