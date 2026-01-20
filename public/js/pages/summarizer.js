/**
 * Summarizer Page Logic
 */

const SummarizerPage = {
    currentSummary: '',

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
        const actionButtons = [
            document.getElementById('copy-btn'),
            document.getElementById('download-md-btn'),
            document.getElementById('download-pdf-btn')
        ];

        summarizeBtn.disabled = true;
        progressSection.classList.remove('hidden');
        actionButtons.forEach(btn => btn?.classList.add('hidden'));

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

                if (status.summary) {
                    this.currentSummary = status.summary;
                    this.renderPreview(this.currentSummary);
                }

                if (status.status === 'completed') {
                    completed = true;
                    this.currentSummary = status.summary;
                    this.renderPreview(this.currentSummary);
                    progressSection.classList.add('hidden');
                    actionButtons.forEach(btn => btn?.classList.remove('hidden'));
                    window.utils.showToast(window.i18n?.t('summarizer.summaryComplete') || 'Özetleme tamamlandı!', 'success');
                } else if (status.status === 'failed') {
                    throw new Error(status.error || window.i18n?.t('summarizer.summaryFailed') || 'Özetleme başarısız');
                } else {
                    await new Promise(r => setTimeout(r, 5000));
                }
            }

        } catch (error) {
            console.error('Summarize error:', error);
            window.utils.showToast(error.message || 'Özetleme hatası', 'error');
            progressSection.classList.add('hidden');
        }

        summarizeBtn.disabled = false;
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
        preview.innerHTML = marked.parse(markdown);

        // Highlight
        preview.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));

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
        window.preview.copyToClipboard(this.currentSummary);
    },

    downloadMd() {
        if (!this.currentSummary) return;
        window.preview.downloadMarkdown(this.currentSummary, 'ozet.md');
    },

    async downloadPdf() {
        if (!this.currentSummary) return;
        await window.preview.downloadPdf(this.currentSummary, 'ozet.pdf');
    }
};

window.SummarizerPage = SummarizerPage;
