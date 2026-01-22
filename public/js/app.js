// Main Application Entry Point

const App = {
    // Global State
    currentMarkdown: '',
    currentFilename: '',
    generatedTitle: null,
    titleMarkdownHash: '',
    currentView: 'split',

    init() {
        // Initialize Core Modules
        if (window.ThemeManager) {
            window.ThemeManager.init();
        }

        // Define Routes
        const routes = {
            '/': window.HomePage,
            '/summarizer': window.SummarizerPage,
            '/md-to-pdf': window.MdToPdfPage
        };

        // Initialize Router
        window.Router.init(routes);

        // Global Event Listeners (e.g. for escape key, global shortcuts)
        this.bindGlobalEvents();

        // Health Check
        window.api?.healthCheck().then(ok => {
            if (!ok) window.utils.showToast('Sunucu bağlantısı kurulamadı', 'error');
        });
    },

    bindGlobalEvents() {
        // Prevent default drag/drop handler on window
        window.addEventListener('dragover', e => e.preventDefault(), false);
        window.addEventListener('drop', e => e.preventDefault(), false);

        // Mobile Menu Toggle
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');

        if (mobileMenuBtn && mobileMenu) {
            mobileMenuBtn.addEventListener('click', () => {
                mobileMenu.classList.toggle('hidden');
            });

            // Close menu when clicking a link
            mobileMenu.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', () => {
                    mobileMenu.classList.add('hidden');
                });
            });
        }
    },

    // Shared Methods (download logic etc.)
    setView(view) {
        this.currentView = view;

        const markdownPanel = document.getElementById('markdown-panel');
        const previewPanel = document.getElementById('preview-panel');
        const contentPanels = document.getElementById('content-panels');

        if (!markdownPanel || !previewPanel || !contentPanels) return;

        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.id === `tab-${view}`) {
                btn.classList.add('active', 'bg-slate-700', 'text-white');
                btn.classList.remove('text-slate-400');
            } else {
                btn.classList.remove('active', 'bg-slate-700', 'text-white');
                btn.classList.add('text-slate-400');
            }
        });

        // Update panels
        switch (view) {
            case 'markdown':
                markdownPanel.classList.remove('hidden');
                previewPanel.classList.add('hidden');
                contentPanels.style.gridTemplateColumns = '1fr';
                contentPanels.classList.remove('split-view');
                break;
            case 'preview':
                markdownPanel.classList.add('hidden');
                previewPanel.classList.remove('hidden');
                contentPanels.style.gridTemplateColumns = '1fr';
                contentPanels.classList.remove('split-view');
                break;
            case 'split':
                markdownPanel.classList.remove('hidden');
                previewPanel.classList.remove('hidden');
                contentPanels.style.gridTemplateColumns = '1fr 1fr';
                contentPanels.classList.add('split-view');
                break;
        }
    },

    async handleDownloadMd() {
        const markdown = document.getElementById('markdown-editor')?.value || '';

        if (!markdown.trim()) {
            window.utils.showToast(window.i18n?.t('toast.emptyContent') || 'Content is empty', 'error');
            return;
        }

        try {
            await this.ensureTitle(markdown);

            // Save to Drive and download (or just download)
            const response = await fetch('/api/save/markdown', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markdown, filename: `${this.generatedTitle}.md` })
            });

            const result = await response.json();

            if (result.success && result.fileId) {
                // Proxy download
                window.location.href = `/api/download/${result.fileId}`;
                window.utils.showToast(window.i18n?.t('toast.downloadStarted') || 'Download started', 'success');
            } else {
                throw new Error(result.error || 'Kaydetme başarısız');
            }
        } catch (error) {
            console.error('Save error:', error);
            // Fallback to client-side download
            window.preview.downloadMarkdown(markdown, this.currentFilename || 'document.md');
        }
    },

    async handleDownloadPdf() {
        const markdown = document.getElementById('markdown-editor')?.value || '';

        if (!markdown.trim()) {
            window.utils.showToast(window.i18n?.t('toast.emptyContent') || 'Content is empty', 'error');
            return;
        }

        try {
            await this.ensureTitle(markdown);
            await window.preview.downloadPdf(markdown, `${this.generatedTitle}.pdf`);
        } catch (error) {
            console.error('Title generation error:', error);
            await window.preview.downloadPdf(markdown, this.currentFilename || 'document.pdf');
        }
    },

    async ensureTitle(markdown) {
        const currentHash = window.utils.simpleHash(markdown);

        // Only generate title if not cached or content changed
        if (!this.generatedTitle || this.titleMarkdownHash !== currentHash) {
            window.utils.showToast(window.i18n?.t('toast.generatingFilename') || 'Generating filename...', 'info');

            // Get currently selected model
            const modelSelect = document.getElementById('model-select');
            const selectedModel = modelSelect ? modelSelect.value : null;

            const titleResponse = await fetch('/api/generate-title', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markdown, model: selectedModel })
            });
            const titleResult = await titleResponse.json();
            const titleToUse = titleResult.title || 'document';

            // Cache the result
            this.generatedTitle = titleToUse;
            this.titleMarkdownHash = currentHash;
        }
    }
};

window.app = App;

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
