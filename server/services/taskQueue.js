const EventEmitter = require('events');
const { default: PQueue } = require('p-queue');

class TaskQueue extends EventEmitter {
  constructor(processor, options = {}) {
    super();
    this.processor = processor;
    this.maxConcurrency = options.concurrency || 3;
    this.queue = new PQueue({ concurrency: this.maxConcurrency });
    this.tasks = new Map();
  }

  add(task) {
    this.tasks.set(task.id, task);
    this.emit('taskAdded', this.sanitize(task));

    this.queue.add(async () => {
      try {
        await this.processor(task, this);
      } catch (error) {
        console.error(`❌ Task ${task.id} processor error:`, error.message);
        if (task.status !== 'cancelled' && !task.abortController.signal.aborted) {
          task.status = 'failed';
          task.phase = 'failed';
          task.message = error.message || 'İşlem başarısız';
          task.error = error.message;
          this.emit('taskUpdated', this.sanitize(task));
        }
      }
    });
  }

  get(id) {
    return this.tasks.get(id);
  }

  getAll() {
    return Array.from(this.tasks.values()).map((t) => this.sanitize(t));
  }

  cancel(id) {
    const task = this.tasks.get(id);
    if (!task) return false;
    if (['completed', 'failed', 'cancelled'].includes(task.status)) return false;

    task.abortController.abort();
    task.status = 'cancelled';
    task.phase = 'cancelled';
    task.message = 'İptal edildi';
    task.error = 'Kullanıcı tarafından iptal edildi';
    this.emit('taskUpdated', this.sanitize(task));
    return true;
  }

  getStatus() {
    return {
      active: this.queue.pending, // p-queue: currently running
      queued: this.queue.size,    // p-queue: waiting in queue
      max: this.maxConcurrency,
    };
  }

  sanitize(task, { includeMarkdown = false } = {}) {
    return {
      id: task.id,
      type: task.type,
      status: task.status,
      phase: task.phase,
      message: task.message,
      progress: task.progress,
      filename: task.filename,
      outputFormat: task.outputFormat,
      model: task.model,
      aiDecision: task.aiDecision,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      error: task.error,
      // Include markdown only when explicitly requested (single task fetch)
      ...(includeMarkdown && { markdown: task.markdown || null }),
      files: task.files.map((f) => ({
        filename: f.filename,
        mimetype: f.mimetype,
        size: f.size,
      })),
    };
  }
}

module.exports = { TaskQueue };
