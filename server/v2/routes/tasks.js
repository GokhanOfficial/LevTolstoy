const express = require('express');
const router = express.Router();
const { TaskQueue } = require('../services/taskQueue');
const { createTask, processTask } = require('../services/taskProcessor');
const config = require('../../config');

const taskQueue = new TaskQueue(processTask, { concurrency: 3 });

// POST /api/v2/tasks
router.post('/', async (req, res) => {
  try {
    const { files, type, model, outputFormat, mergeMode } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Dosya listesi boş', errorKey: 'errors.noFile' });
    }

    if (!type || !['auto', 'convert', 'summarize'].includes(type)) {
      return res.status(400).json({ error: 'Geçersiz işlem tipi', errorKey: 'errors.invalidType' });
    }

    if (mergeMode === 'separate') {
      // Each file becomes its own task
      const createdTasks = [];
      for (const file of files) {
        const task = createTask({
          files: [file],
          type,
          model,
          outputFormat,
          mergeMode: 'separate',
        });
        taskQueue.add(task);
        createdTasks.push(taskQueue.sanitize(task));
      }
      return res.json({ success: true, tasks: createdTasks });
    }

    const task = createTask({ files, type, model, outputFormat, mergeMode });
    taskQueue.add(task);

    res.json({ success: true, task: taskQueue.sanitize(task) });
  } catch (error) {
    console.error('Task creation error:', error.message);
    res.status(500).json({ error: error.message, errorKey: 'errors.taskStartFailed' });
  }
});

// GET /api/v2/tasks
router.get('/', (req, res) => {
  try {
    const tasks = taskQueue.getAll();
    res.json({ tasks, queue: taskQueue.getStatus() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v2/tasks/:id
router.get('/:id', (req, res) => {
  try {
    const task = taskQueue.get(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task bulunamadı', errorKey: 'errors.taskNotFound' });
    }
    res.json(taskQueue.sanitize(task));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v2/tasks/:id/cancel
router.post('/:id/cancel', (req, res) => {
  try {
    const success = taskQueue.cancel(req.params.id);
    if (!success) {
      return res.status(400).json({ error: 'Task iptal edilemedi', errorKey: 'errors.cancelFailed' });
    }
    const task = taskQueue.get(req.params.id);
    res.json({ success: true, task: taskQueue.sanitize(task) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v2/tasks/:id/download
router.get('/:id/download', (req, res) => {
  try {
    const task = taskQueue.get(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task bulunamadı', errorKey: 'errors.taskNotFound' });
    }

    if (task.status !== 'completed') {
      return res.status(400).json({ error: 'Task tamamlanmadı', errorKey: 'errors.taskNotCompleted' });
    }

    const format = req.query.format || task.outputFormat;
    const filename = task.filename || 'document';

    if (format === 'pdf') {
      if (!task.pdfBuffer) {
        return res.status(400).json({ error: 'PDF hazır değil', errorKey: 'errors.pdfNotReady' });
      }
      const pdfName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(pdfName)}`);
      res.send(task.pdfBuffer);
    } else if (format === 'html') {
      if (!task.htmlContent) {
        return res.status(400).json({ error: 'HTML hazır değil', errorKey: 'errors.htmlNotReady' });
      }
      const htmlName = filename.endsWith('.html') ? filename : `${filename}.html`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(htmlName)}`);
      res.send(task.htmlContent);
    } else {
      // markdown
      const mdName = filename.endsWith('.md') ? filename : `${filename}.md`;
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(mdName)}`);
      res.send(task.markdown || '');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SSE stream for real-time updates
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const onUpdate = (task) => {
    res.write(`data: ${JSON.stringify(task)}\n\n`);
  };

  taskQueue.on('taskUpdated', onUpdate);
  taskQueue.on('taskAdded', onUpdate);

  req.on('close', () => {
    taskQueue.off('taskUpdated', onUpdate);
    taskQueue.off('taskAdded', onUpdate);
  });
});

module.exports = { router, taskQueue };
