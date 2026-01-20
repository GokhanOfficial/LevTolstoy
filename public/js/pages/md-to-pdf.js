/**
 * MD to PDF Page Logic
 */

const MdToPdfPage = {
    mount() {
        console.log('MdToPdfPage mounted');

        // Initial setup
        const editor = document.getElementById('markdown-editor');
        const previewContent = document.getElementById('preview-content');

        if (!editor || !previewContent) {
            console.error('Editor or preview elements not found');
            return;
        }

        // Initialize Theme if needed (handled globally mostly, but toggle is local)
        this.initThemeToggle();

        // Editor sync with preview
        editor.addEventListener('input', (e) => {
            const markdown = e.target.value;
            window.preview.updatePreview(markdown);
            window.preview.updateCharCount(markdown);
        });

        // Initial preview update
        window.preview.updatePreview(editor.value);
        window.preview.updateCharCount(editor.value);

        // Synchronized scrolling
        this.initSyncScroll(editor, previewContent);

        // Copy button
        document.getElementById('copy-btn')?.addEventListener('click', () => {
            window.preview.copyToClipboard(editor.value);
        });

        // Download MD button
        document.getElementById('download-md-btn')?.addEventListener('click', () => {
            this.handleDownloadMd(editor.value);
        });

        // Download PDF button
        document.getElementById('download-pdf-btn')?.addEventListener('click', () => {
            this.handleDownloadPdf(editor.value);
        });

        // Title caching state
        this.generatedTitle = null;
        this.titleMarkdownHash = '';
    },

    initThemeToggle() {
        // Theme logic is mostly handled by window.ThemeManager in theme.js
        // But the toggle button specific to this page might need listener if not global
        const toggleBtn = document.getElementById('theme-toggle');
        if (toggleBtn) {
            // Remove old listeners by cloning (if needed, or just add since it's mount)
            // But usually theme toggle is in header and might be global? 
            // Checking HTML, it is in header. Header is shared partial or copied?
            // In this project it seems copied. So we need to bind it.

            // Note: theme.js should ideally handle this if it selects correctly.
            // Let's rely on theme.js init if it runs on valid DOM, or re-run it.
            if (window.ThemeManager) {
                window.ThemeManager.init();
            }
        }
    },

    initSyncScroll(editor, previewContent) {
        let isScrolling = false;

        editor.addEventListener('scroll', () => {
            if (isScrolling) return;
            isScrolling = true;

            const scrollPercentage = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
            previewContent.scrollTop = scrollPercentage * (previewContent.scrollHeight - previewContent.clientHeight);

            setTimeout(() => isScrolling = false, 50);
        });

        previewContent.addEventListener('scroll', () => {
            if (isScrolling) return;
            isScrolling = true;

            const scrollPercentage = previewContent.scrollTop / (previewContent.scrollHeight - previewContent.clientHeight);
            editor.scrollTop = scrollPercentage * (editor.scrollHeight - editor.clientHeight);

            setTimeout(() => isScrolling = false, 50);
        });
    },

    async handleDownloadMd(markdown) {
        if (!markdown.trim()) {
            window.utils.showToast(window.i18n?.t('toast.emptyContent') || 'Content is empty', 'error');
            return;
        }

        try {
            await this.ensureTitle(markdown);

            const response = await fetch('/api/save/markdown', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markdown, filename: `${this.generatedTitle}.md` })
            });

            const result = await response.json();

            if (result.success && result.fileId) {
                window.location.href = `/api/download/${result.fileId}`;
                window.utils.showToast(window.i18n?.t('toast.downloadStarted') || 'Download started', 'success');
            } else {
                throw new Error(result.error || 'Kaydetme başarısız');
            }
        } catch (error) {
            console.error('Save error:', error);
            window.preview.downloadMarkdown(markdown, 'document.md');
        }
    },

    async handleDownloadPdf(markdown) {
        if (!markdown.trim()) {
            window.utils.showToast(window.i18n?.t('toast.emptyContent') || 'Content is empty', 'error');
            return;
        }

        try {
            await this.ensureTitle(markdown);
            await window.preview.downloadPdf(markdown, `${this.generatedTitle}.pdf`);
        } catch (error) {
            console.error('Title generation error:', error);
            await window.preview.downloadPdf(markdown, 'document.pdf');
        }
    },

    async ensureTitle(markdown) {
        const currentHash = window.utils.simpleHash(markdown);

        if (!this.generatedTitle || this.titleMarkdownHash !== currentHash) {
            window.utils.showToast(window.i18n?.t('toast.generatingFilename') || 'Generating filename...', 'info');

            const titleResponse = await fetch('/api/generate-title', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markdown })
            });
            const titleResult = await titleResponse.json();
            const titleToUse = titleResult.title || 'document';

            this.generatedTitle = titleToUse;
            this.titleMarkdownHash = currentHash;
        }
    }
};

window.MdToPdfPage = MdToPdfPage;
