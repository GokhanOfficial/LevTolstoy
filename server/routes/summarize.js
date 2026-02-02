const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const openai = require('../services/openai');

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
 * POST /api/summarize/start - Start a summarization task
 */
router.post('/start', async (req, res) => {
    try {
        const { markdown, model } = req.body;

        if (!markdown || markdown.trim().length === 0) {
            return res.status(400).json({
                error: 'Metin boş olamaz',
                errorKey: 'errors.emptyText'
            });
        }

        // Create task
        const taskId = crypto.randomUUID();
        const task = {
            id: taskId,
            status: TaskStatus.PENDING,
            summary: '',
            filename: null,
            progress: 0,
            error: null,
            createdAt: Date.now(),
            model: model || 'gpt-4o'
        };

        tasks.set(taskId, task);

        console.log(`📝 Özetleme task başlatıldı: ${taskId} (model: ${task.model})`);

        // Start processing in background
        processSummarization(taskId, markdown, task.model);

        res.json({
            success: true,
            taskId,
            status: task.status
        });

    } catch (error) {
        console.error('Özetleme task başlatma hatası:', error.message);
        res.status(500).json({
            error: error.message,
            errorKey: 'errors.taskStartFailed'
        });
    }
});

/**
 * GET /api/summarize/status/:taskId - Get task status
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
        summary: task.summary,
        filename: task.filename,
        progress: task.progress,
        error: task.error
    });
});

/**
 * Process summarization in background using openai service
 */
async function processSummarization(taskId, markdown, model) {
    const task = tasks.get(taskId);
    if (!task) return;

    try {
        task.status = TaskStatus.PROCESSING;
        task.progress = 10; // Started

        // Use openai service to summarize with streaming callback
        const summary = await openai.summarizeText(markdown, model, (chunk) => {
            // Update task with new chunk
            task.summary += chunk;

            // Artificial progress increment up to 90%
            if (task.progress < 90) {
                task.progress += 2;
            }
        });

        // Ensure final summary is set (though callback should have built it mostly)
        // Note: The callback builds `task.summary` incrementally. 
        // The return value `summary` from `summarizeText` is the clean final text.
        // We should overwrite with the final clean text to ensures markdown blocks are stripped correctly at the end.
        task.summary = summary;

        // Generate filename from summary content
        try {
            task.filename = await openai.generateFilename(summary, model);
            console.log(`🏷️ Özet dosya adı: ${task.filename}`);
        } catch (filenameError) {
            console.warn('Dosya adı üretilemedi, varsayılan kullanılacak:', filenameError.message);
            task.filename = 'ozet';
        }

        task.progress = 100;
        task.status = TaskStatus.COMPLETED;

        console.log(`✅ Özetleme tamamlandı: ${taskId}`);

    } catch (error) {
        console.error(`❌ Özetleme hatası (${taskId}):`, error.message);
        task.status = TaskStatus.FAILED;
        task.error = error.message;
    }

    // Clean up task after 30 minutes
    setTimeout(() => {
        tasks.delete(taskId);
    }, 30 * 60 * 1000);
}

module.exports = router;
