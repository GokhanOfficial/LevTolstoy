/**
 * Summarizer Page Logic
 */

const SummarizerPage = {
    currentSummary: '',
    currentFilename: 'ozet',

    mount() {
        console.log('SummarizerPage mounted');

        // Listeners
        document.getElementById('summarize-btn')?.addEventListener('click', () => this.handleSummarize());
        document.getElementById('copy-btn')?.addEventListener('click', () => this.copySummary());
        document.getElementById('download-md-btn')?.addEventListener('click', () => this.downloadMd());
        document.getElementById('download-pdf-btn')?.addEventListener('click', () => this.downloadPdf());

        // Check for passed markdown
        const passedMarkdown = sessionStorage.getItem('summarizeMarkdown');
        if (passedMarkdown) {
            const inputEditor = document.getElementById('input-editor');
            if (inputEditor) inputEditor.value = passedMarkdown;
            sessionStorage.removeItem('summarizeMarkdown');
        }
    },

    async handleSummarize() {
        const input = document.getElementById('input-editor').value.trim();

        if (!input) {
            window.utils.showToast(window.i18n?.t('summarizer.emptyInput') || 'Lütfen özetlenecek metin girin', 'error');
            return;
        }

        const model = document.getElementById('model-select').value;
        const summarizeBtn = document.getElementById('summarize-btn');
        const progressSection = document.getElementById('progress-section');
        const progressBar = document.getElementById('progress-bar');

        // Ensure we re-query these elements as they might have lost state or class changes
        const copyBtn = document.getElementById('copy-btn');
        const downloadMdBtn = document.getElementById('download-md-btn');
        const downloadPdfBtn = document.getElementById('download-pdf-btn');

        const actionButtons = [copyBtn, downloadMdBtn, downloadPdfBtn].filter(Boolean);

        if (summarizeBtn) summarizeBtn.disabled = true;
        if (progressSection) progressSection.classList.remove('hidden');
        actionButtons.forEach(btn => btn.classList.add('hidden'));

        try {
            // Start summarization task
            const startRes = await fetch('/api/summarize/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markdown: input, model })
            });

            const startData = await startRes.json();

            if (!startRes.ok) {
                throw new Error(startData.error || 'Özetleme başlatılamadı');
            }

            const taskId = startData.taskId;

            // Poll for status
            let completed = false;
            while (!completed) {
                const statusRes = await fetch(`/api/summarize/status/${taskId}`);
                const status = await statusRes.json();

                if (progressBar) progressBar.style.width = `${status.progress || 0}%`;

                // Update progress text with ETA and TPS
                const progressWait = document.querySelector('#progress-section .text-slate-500');
                if (progressWait) {
                    let progressText = '';
                    if (status.eta) {
                        progressText += `ETA: ${status.eta}s`;
                    }
                    if (status.tps) {
                        progressText += (progressText ? ' • ' : '') + `${status.tps} tok/s`;
                    }
                    progressWait.textContent = progressText || (window.i18n?.t('summarizer.wait') || 'Lütfen bekleyin');
                }

                if (status.summary) {
                    this.currentSummary = status.summary;
                    this.renderPreview(this.currentSummary);
                }

                if (status.status === 'completed') {
                    completed = true;
                    this.currentSummary = status.summary;
                    this.currentFilename = status.filename || 'ozet';
                    this.renderPreview(this.currentSummary);

                    if (progressSection) progressSection.classList.add('hidden');

                    // Explicitly show action buttons
                    actionButtons.forEach(btn => {
                        if (btn) btn.classList.remove('hidden');
                    });

                    window.utils.showToast(window.i18n?.t('summarizer.summaryComplete') || 'Özetleme tamamlandı!', 'success');
                } else if (status.status === 'failed') {
                    throw new Error(status.error || window.i18n?.t('summarizer.summaryFailed') || 'Özetleme başarısız');
                } else {
                    await new Promise(r => setTimeout(r, 2000)); // Poll every 2s
                }
            }

        } catch (error) {
            console.error('Summarize error:', error);
            window.utils.showToast(error.message || 'Özetleme hatası', 'error');
            if (progressSection) progressSection.classList.add('hidden');
        }

        if (summarizeBtn) summarizeBtn.disabled = false;
    },

    renderPreview(markdown) {
        const preview = document.getElementById('preview-content');
        if (!preview) return;

        if (!markdown) {
            const placeholder = window.i18n?.t('summarizer.outputPlaceholder') || 'Özet burada görünecek...';
            preview.innerHTML = `<p class="text-slate-500 text-center mt-20 italic">${placeholder}</p>`;
            return;
        }

        // Use marked globally available
        try {
            preview.innerHTML = marked.parse(markdown);
        } catch (e) {
            console.error('Markdown parse error:', e);
            preview.textContent = markdown;
        }

        // Highlight
        preview.querySelectorAll('pre code').forEach(block => {
            if (window.hljs) hljs.highlightElement(block);
        });

        // Katex
        if (typeof renderMathInElement !== 'undefined') {
            renderMathInElement(preview, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false }
                ],
                throwOnError: false,
                strict: false
            });
        }
    },

    copySummary() {
        if (!this.currentSummary) return;
        if (window.preview?.copyToClipboard) {
            window.preview.copyToClipboard(this.currentSummary);
        } else {
            // Fallback
            navigator.clipboard.writeText(this.currentSummary);
            window.utils.showToast(window.i18n?.t('toast.copied') || 'Kopyalandı', 'success');
        }
    },

    downloadMd() {
        if (!this.currentSummary) return;
        if (window.preview?.downloadMarkdown) {
            window.preview.downloadMarkdown(this.currentSummary, `${this.currentFilename}.md`);
        }
    },

    async downloadPdf() {
        if (!this.currentSummary) return;
        if (window.preview?.downloadPdf) {
            await window.preview.downloadPdf(this.currentSummary, `${this.currentFilename}.pdf`);
        }
    }
};

window.SummarizerPage = SummarizerPage;
