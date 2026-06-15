const crypto = require('crypto');
const fileHandler = require('../../services/fileHandler');
const openai = require('../../services/openai');
const { generatePdf } = require('./pdfEngine');
const { generateHtml } = require('./htmlRenderer');
const config = require('../../config');

function createTask({ files, type, model, outputFormat, mergeMode }) {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    type,
    status: 'queued',
    phase: 'queued',
    message: mergeMode === 'single' && files.length > 1 ? `${files.length} dosya sıraya alındı` : 'Sıraya alındı',
    progress: 0,
    files: files.map(f => ({
      filename: f.originalname || f.name || 'file',
      mimetype: f.mimetype,
      size: f.buffer ? f.buffer.length : 0,
      buffer: f.buffer,
    })),
    model: model || config.openai.model || 'gemini-3.5-flash',
    outputFormat: outputFormat || 'pdf',
    mergeMode: mergeMode || 'single',
    aiDecision: null,
    markdown: null,
    pdfBuffer: null,
    htmlContent: null,
    filename: null,
    createdAt: now,
    startedAt: null,
    completedAt: null,
    error: null,
    abortController: new AbortController(),
  };
}

async function decideAutoMode(task, onUpdate) {
  onUpdate({ phase: 'ai-decision', message: 'AI mod kararı veriyor...', progress: 5 });
  const sampleText = task.markdown || task.files.map(f => f.filename).join('\n');
  const excerpt = sampleText.slice(0, 3000);
  const prompt = `You are a document classifier. I will give you the first ~3000 characters of a document.

Decide whether this document should be:
- "convert": Fully converted to Markdown (faithful to the original text, preserving structure, headings, lists, tables, code). Use this for PDFs, DOCX, PPTX, text-heavy documents, reports, academic papers, scripts, transcripts.
- "summarize": Summarized into a shorter Markdown (key points, bullet points, condensed version). Use this for very long articles, books, news, meeting notes, or documents where the user likely wants the gist rather than every detail.

Respond with ONLY one word: "convert" or "summarize". No explanation.

Document excerpt:
---
${excerpt}
---`;

  const client = openai.createClient();
  const response = await client.chat.completions.create({
    model: task.model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 10,
  });
  const decision = (response.choices[0]?.message?.content || 'convert').toLowerCase().trim();
  if (decision !== 'summarize') {
    return 'convert';
  }
  return 'summarize';
}

async function processTask(task, queue) {
  const update = (patch) => {
    Object.assign(task, patch);
    queue.emit('taskUpdated', queue.sanitize(task));
  };

  try {
    task.status = 'processing';
    task.startedAt = Date.now();
    update({ phase: 'loading', message: 'Dosyalar okunuyor', progress: 5 });

    // 1. Prepare files
    const fileInputs = task.files.map(f => ({
      buffer: f.buffer,
      mimetype: f.mimetype,
      originalname: f.filename,
    }));

    if (task.abortController.signal.aborted) throw new Error('İptal edildi');

    // 2. AI processing (convert or summarize)
    update({ phase: 'ai-conversion', message: 'AI ile metinleştiriliyor...', progress: 25 });

    let markdown = '';
    let actualType = task.type;

    if (task.type === 'auto') {
      actualType = await decideAutoMode(task, (p) => update(p));
      task.aiDecision = actualType;
    }

    if (actualType === 'summarize') {
      // For summarize, we need text first. If files are images/PDFs, we must convert first then summarize.
      // Simplification: auto-mode convert files to markdown first, then summarize the result.
      // But for now, let's do: if summarize requested, convert to markdown first (if files), then summarize.
      const rawMarkdown = await fileHandler.processMultipleFiles(fileInputs, task.model, (chunk) => {
        markdown += chunk;
        update({
          progress: Math.min(80, 25 + Math.floor((markdown.length / 10000) * 55)),
        });
      }, {}, {
        signal: task.abortController.signal,
        onFileStart: ({ file, index, total }) => {
          update({ message: `Dosya işleniyor (${index + 1}/${total}): ${file.originalname}` });
        },
        onMediaProgress: (progress) => {
          update({
            phase: 'media-encoding',
            message: `FFmpeg ile MP3'e dönüştürülüyor (${progress.percent || 0}%)`,
            progress: Math.min(80, 30 + Math.floor((progress.percent || 0) * 0.45)),
          });
        },
        onAiStart: () => {
          update({ phase: 'ai-conversion', message: 'AI ile özetleniyor...', progress: 60 });
        },
      });
      markdown = rawMarkdown;

      if (task.abortController.signal.aborted) throw new Error('İptal edildi');

      update({ phase: 'ai-conversion', message: 'AI ile özetleniyor...', progress: 60 });
      const summary = await openai.summarizeText(markdown, task.model, (chunk) => {
        // summarize doesn't stream by chunk to task, but we could update progress
        update({ progress: Math.min(90, 60 + Math.floor((task.markdown?.length || 0) / 10000) * 30) });
      });
      markdown = summary;
    } else {
      // Convert mode
      markdown = await fileHandler.processMultipleFiles(fileInputs, task.model, (chunk) => {
        markdown += chunk;
        update({
          progress: Math.min(80, 25 + Math.floor((markdown.length / 10000) * 55)),
        });
      }, {}, {
        signal: task.abortController.signal,
        onFileStart: ({ file, index, total }) => {
          update({ message: `Dosya işleniyor (${index + 1}/${total}): ${file.originalname}` });
        },
        onMediaProgress: (progress) => {
          update({
            phase: 'media-encoding',
            message: `FFmpeg ile MP3'e dönüştürülüyor (${progress.percent || 0}%)`,
            progress: Math.min(80, 30 + Math.floor((progress.percent || 0) * 0.45)),
          });
        },
        onAiStart: () => {
          update({ phase: 'ai-conversion', message: 'AI ile metinleştiriliyor...', progress: 60 });
        },
      });
    }

    task.markdown = markdown;

    if (task.abortController.signal.aborted) throw new Error('İptal edildi');

    // 3. Generate filename
    try {
      task.filename = await openai.generateFilename(markdown, task.model);
    } catch (e) {
      console.warn('Filename generation failed, using default:', e.message);
      task.filename = 'document';
    }

    // 4. Render output
    if (task.outputFormat === 'pdf') {
      update({ phase: 'rendering', message: 'PDF oluşturuluyor...', progress: 90 });
      task.pdfBuffer = await generatePdf(markdown, task.filename);
    } else if (task.outputFormat === 'html') {
      update({ phase: 'rendering', message: 'HTML oluşturuluyor...', progress: 90 });
      task.htmlContent = await generateHtml(markdown, task.filename);
    }
    // markdown output: already in task.markdown

    if (task.abortController.signal.aborted) throw new Error('İptal edildi');

    task.status = 'completed';
    task.phase = 'completed';
    task.progress = 100;
    task.message = 'Tamamlandı';
    task.completedAt = Date.now();
    update({});

    console.log(`✅ Task tamamlandı: ${task.id}`);

    // Cleanup after 30 minutes
    setTimeout(() => {
      queue.tasks.delete(task.id);
    }, 30 * 60 * 1000);
  } catch (error) {
    const wasCancelled = task.abortController.signal.aborted || task.status === 'cancelled';
    console.error(`${wasCancelled ? '🛑' : '❌'} Task ${wasCancelled ? 'iptal' : 'hata'} (${task.id}):`, error.message);
    task.status = wasCancelled ? 'cancelled' : 'failed';
    task.phase = wasCancelled ? 'cancelled' : 'failed';
    task.message = wasCancelled ? 'İptal edildi' : 'İşlem başarısız';
    task.error = error.message;
    update({});
  }
}

module.exports = { createTask, processTask };
