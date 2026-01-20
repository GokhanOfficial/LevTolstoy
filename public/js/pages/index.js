/**
 * Home Page Logic (Index)
 */

const HomePage = {
    mount() {
        console.log('HomePage mounted');

        // Initialize file upload if available
        // Initialize file upload if available
        if (window.fileUpload) {
            const dropZone = document.getElementById('drop-zone');
            const fileInput = document.getElementById('file-input');

            if (dropZone && fileInput) {
                window.fileUpload.init(dropZone, fileInput);
            }
        }

        // Convert button
        const convertBtn = document.getElementById('convert-btn');
        if (convertBtn) {
            convertBtn.addEventListener('click', this.handleConvert);
        }

        // View tabs
        document.getElementById('tab-markdown')?.addEventListener('click', () => window.app.setView('markdown')); // Assuming app.js exposes setView
        document.getElementById('tab-preview')?.addEventListener('click', () => window.app.setView('preview'));
        document.getElementById('tab-split')?.addEventListener('click', () => window.app.setView('split'));

        // Initialize buttons
        this.initButtons();
    },

    initButtons() {
        // Copy button
        document.getElementById('copy-btn')?.addEventListener('click', () => {
            const markdown = document.getElementById('markdown-editor')?.value || '';
            window.preview.copyToClipboard(markdown);
        });

        // Download MD button
        document.getElementById('download-md-btn')?.addEventListener('click', async () => {
            // ... logic from app.js ...
            // We will refactor app.js to expose common actions or move them here.
            // For now, let's assume we'll call a shared method or keep it here.
            window.app.handleDownloadMd();
        });

        // Download PDF button
        document.getElementById('download-pdf-btn')?.addEventListener('click', async () => {
            window.app.handleDownloadPdf();
        });

        // Summarize button
        document.getElementById('summarize-btn')?.addEventListener('click', () => {
            const markdown = document.getElementById('markdown-editor')?.value;
            if (!markdown || markdown.trim().length === 0) {
                window.utils.showToast('Özetlenecek içerik yok', 'error');
                return;
            }
            sessionStorage.setItem('summarizeMarkdown', markdown);
            window.Router.navigate('/summarizer');
        });

        // Editor sync with preview
        document.getElementById('markdown-editor')?.addEventListener('input', (e) => {
            const markdown = e.target.value;
            window.preview.updatePreview(markdown);
            window.preview.updateCharCount(markdown);
        });
    },

    async handleConvert() {
        // Logic moved from app.js handleConvert
        // We can call window.app.handleConvert() if we keep it there, 
        // or move it here. Let's move it here to keep pages distinct.

        const cachedFiles = window.fileUpload?.getCachedFiles() || [];

        if (cachedFiles.length === 0) {
            window.utils.showToast(window.i18n?.t('toast.noFiles') || 'Please select files first', 'error');
            return;
        }

        // Check if files are still uploading
        if (window.fileUpload?.isUploading()) {
            window.utils.showToast('Dosyalar yükleniyor, lütfen bekleyin...', 'info');
            return;
        }

        // Show progress
        const progressSection = document.getElementById('progress-section');
        const resultSection = document.getElementById('result-section');
        const convertBtn = document.getElementById('convert-btn');

        convertBtn.disabled = true;
        progressSection.classList.remove('hidden');

        // Display file count
        document.getElementById('progress-filename').textContent =
            cachedFiles.length === 1 ? cachedFiles[0].filename : `${cachedFiles.length} dosya`;

        const progressBar = document.getElementById('progress-bar');

        try {
            // Update all file statuses
            cachedFiles.forEach((_, i) => window.fileUpload.updateFileStatus(i, 'converting'));

            // Get selected model
            const modelSelect = document.getElementById('model-select');
            const selectedModel = modelSelect ? modelSelect.value : 'gemini-3-flash-preview';

            // Start conversion task
            const startResult = await window.api.startConversion(cachedFiles, selectedModel);

            if (!startResult.success) {
                throw new Error(startResult.error);
            }

            const taskId = startResult.taskId;

            // Poll for status every 5 seconds
            let completed = false;
            while (!completed) {
                const status = await window.api.getConversionStatus(taskId);

                // Update progress bar
                progressBar.style.width = `${status.progress || 0}%`;

                // Update preview with partial result
                if (status.markdown) {
                    window.app.currentMarkdown = status.markdown;
                    const editor = document.getElementById('markdown-editor');
                    if (editor) editor.value = status.markdown;
                    window.preview.updatePreview(status.markdown);
                }

                if (status.status === 'completed') {
                    completed = true;
                    window.app.currentMarkdown = status.markdown;
                    window.app.currentFilename = cachedFiles.length === 1 ? cachedFiles[0].filename : 'combined';

                    // Update editor
                    const editor = document.getElementById('markdown-editor');
                    if (editor) editor.value = status.markdown;

                    // Update preview
                    window.preview.updatePreview(status.markdown);
                    window.preview.updateCharCount(status.markdown);

                    // Show result section
                    progressSection.classList.add('hidden');
                    resultSection.classList.remove('hidden');

                    // Update all file statuses
                    cachedFiles.forEach((_, i) => window.fileUpload.updateFileStatus(i, 'done'));
                    window.utils.showToast(window.i18n?.t('toast.conversionComplete') || 'Conversion complete!', 'success');

                } else if (status.status === 'failed') {
                    throw new Error(status.error || 'Conversion failed');

                } else {
                    // Wait 5 seconds before next poll
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }

        } catch (error) {
            console.error('Conversion error:', error);
            cachedFiles.forEach((_, i) => window.fileUpload.updateFileStatus(i, 'error'));
            window.utils.showToast(error.message || window.i18n?.t('toast.conversionFailed') || 'Conversion failed', 'error');
            progressSection.classList.add('hidden');
        }

        convertBtn.disabled = false;
    }
};

window.HomePage = HomePage;
