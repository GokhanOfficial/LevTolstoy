/**
 * Home Page Logic (Index)
 */

let activeConversionTaskId = null;
let cancelRequested = false;

function formatProgressDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '-';
    if (seconds < 60) return `${Math.ceil(seconds)} sn`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${minutes} dk ${secs} sn`;
}

function formatProgressPhase(phase) {
    const labels = {
        queued: 'Sırada',
        loading: 'Dosya okunuyor',
        fetching: 'Dosya indiriliyor',
        preparing: 'Hazırlanıyor',
        'media-encoding': 'FFmpeg dönüşümü',
        'ai-conversion': 'AI metinleştirme',
        completed: 'Tamamlandı',
        failed: 'Hata',
        cancelled: 'İptal edildi'
    };
    return labels[phase] || phase || 'İşleniyor';
}

function updateConversionProgress(status) {
    const progressBar = document.getElementById('progress-bar');
    const progressTitle = document.getElementById('progress-title');
    const progressFilename = document.getElementById('progress-filename');
    const progressDetail = document.getElementById('progress-detail');
    const progressPhase = document.getElementById('progress-phase');
    const progressPercent = document.getElementById('progress-percent');

    const progress = status.progress || 0;
    if (progressBar) progressBar.style.width = `${progress}%`;
    if (progressTitle) progressTitle.textContent = status.message || 'Dönüştürülüyor...';
    if (progressFilename) progressFilename.textContent = status.currentFile || '';
    if (progressPhase) progressPhase.textContent = formatProgressPhase(status.phase || status.status);
    if (progressPercent) progressPercent.textContent = `${progress}% • kalan ${formatProgressDuration(status.etaSeconds)}`;

    if (progressDetail) {
        const media = status.mediaProgress;
        const ai = status.aiProgress;
        if (media) {
            const bitrate = media.bitrateKbps ? `Bitrate: ${media.bitrateKbps}kbps` : 'Bitrate hesaplanıyor';
            const attempt = media.attempt ? `Deneme: ${media.attempt}` : '';
            const duration = media.duration ? `Süre: ${formatProgressDuration(media.duration)}` : '';
            const elapsed = media.elapsedSeconds ? `Geçen: ${formatProgressDuration(media.elapsedSeconds)}` : '';
            const eta = `Kalan: ${formatProgressDuration(media.etaSeconds ?? status.etaSeconds)}`;
            progressDetail.innerHTML = `
                <span class="block text-indigo-300">FFmpeg: ${media.percent || 0}% • ${bitrate}${attempt ? ` • ${attempt}` : ''}</span>
                <span class="block">${[duration, elapsed, eta].filter(Boolean).join(' • ')}</span>
            `;
        } else if (ai) {
            const chars = typeof ai.chars === 'number' ? ai.chars.toLocaleString('tr-TR') : '0';
            const expected = typeof ai.expectedChars === 'number' ? ai.expectedChars.toLocaleString('tr-TR') : '10.000';
            progressDetail.innerHTML = `
                <span class="block text-indigo-300">AI ilerleme: ${ai.percent || 0}% • ${chars}/${expected} karakter</span>
                <span class="block">Geçen: ${formatProgressDuration(ai.elapsedSeconds)} • Kalan: ${formatProgressDuration(ai.etaSeconds ?? status.etaSeconds)}</span>
            `;
        } else {
            progressDetail.textContent = `${status.message || ''}${status.etaSeconds ? ` • Kalan: ${formatProgressDuration(status.etaSeconds)}` : ''}`;
        }
    }
}

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

        const cancelBtn = document.getElementById('cancel-conversion-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', async () => {
                if (!activeConversionTaskId) return;
                cancelRequested = true;
                cancelBtn.disabled = true;
                cancelBtn.textContent = 'İptal ediliyor...';
                await window.api.cancelConversion(activeConversionTaskId);
            });
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
            window.utils.showToast(window.i18n?.t('toast.uploadingWait') || 'Dosyalar yükleniyor, lütfen bekleyin...', 'info');
            return;
        }

        // Show progress
        const progressSection = document.getElementById('progress-section');
        const resultSection = document.getElementById('result-section');
        const convertBtn = document.getElementById('convert-btn');

        if (convertBtn) convertBtn.disabled = true;
        if (progressSection) progressSection.classList.remove('hidden');

        // Display file count
        const progressFilename = document.getElementById('progress-filename');
        if (progressFilename) {
            progressFilename.textContent = cachedFiles.length === 1 ? cachedFiles[0].filename : `${cachedFiles.length} dosya`;
        }

        const cancelBtn = document.getElementById('cancel-conversion-btn');

        try {
            // Update all file statuses
            cachedFiles.forEach((_, i) => window.fileUpload.updateFileStatus(i, 'converting'));

            // Get selected model
            const modelSelect = document.getElementById('model-select');
            const selectedModel = modelSelect ? modelSelect.value : 'gemini-3-flash-preview';

            cancelRequested = false;
            if (cancelBtn) {
                cancelBtn.disabled = false;
                cancelBtn.textContent = 'İptal Et';
            }

            // Start conversion task
            const startResult = await window.api.startConversion(cachedFiles, selectedModel);

            if (!startResult.success) {
                // If specific error about file missing, we might want to be smart.
                // For now, if start fails, assume files are invalid/expired.
                throw new Error(startResult.error);
            }

            const taskId = startResult.taskId;
            activeConversionTaskId = taskId;

            updateConversionProgress({ progress: 0, phase: 'queued', message: 'Dönüştürme başlatılıyor...', etaSeconds: 60 });

            // Poll for status every second so FFmpeg/upload-like progress feels real-time
            let completed = false;
            while (!completed) {
                const status = await window.api.getConversionStatus(taskId);

                updateConversionProgress(status);

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
                    if (progressSection) progressSection.classList.add('hidden');
                    if (resultSection) resultSection.classList.remove('hidden');

                    // Update all file statuses
                    cachedFiles.forEach((_, i) => window.fileUpload.updateFileStatus(i, 'done'));
                    window.utils.showToast(window.i18n?.t('toast.conversionComplete') || 'Conversion complete!', 'success');

                } else if (status.status === 'cancelled') {
                    completed = true;
                    cachedFiles.forEach((_, i) => window.fileUpload.updateFileStatus(i, 'cancelled'));
                    window.utils.showToast('Dönüştürme iptal edildi', 'info');
                    if (progressSection) progressSection.classList.add('hidden');
                    activeConversionTaskId = null;
                } else if (status.status === 'failed') {
                    throw new Error(status.error || 'Conversion failed');

                } else {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            activeConversionTaskId = null;

        } catch (error) {
            console.error('Conversion error:', error);
            cachedFiles.forEach((_, i) => window.fileUpload.updateFileStatus(i, cancelRequested ? 'cancelled' : 'error'));

            window.utils.showToast(cancelRequested ? 'Dönüştürme iptal edildi' : (error.message || window.i18n?.t('toast.conversionFailed') || 'Conversion failed'), cancelRequested ? 'info' : 'error');
            if (progressSection) progressSection.classList.add('hidden');

            // Handling missing files / retry logic
            // We remove the files from the UI so the user can re-upload them.
            // Since we can't easily map back cacheInfo to index without id, we will clear all for now or improved logic.
            // For now, simpler approach: Remove these specific files if possible. 
            // In a real app we'd map IDs. Here, we just clear and ask user to re-add to be safe.

            // However, user said "dosya silinmediyse kullanılmaya devam edilmeli". 
            // Check if error implies file missing.
            const isMissingFile = error.message.includes('not found') || error.message.includes('no longer exists') || error.message.includes('ENOENT');

            if (isMissingFile) {
                window.utils.showToast('Dosya sunucuda bulunamadı (zaman aşımı). Listeden kaldırıldı, lütfen tekrar yükleyin.', 'warning');
                // For simplicity, clear list or remove specifics.
                // Ideally we find the file that failed. Since we bundle, we might have to remove all.
                window.fileUpload.clearFiles();
            }
        }

        activeConversionTaskId = null;
        cancelRequested = false;
        if (cancelBtn) {
            cancelBtn.disabled = false;
            cancelBtn.textContent = 'İptal Et';
        }
        if (convertBtn) convertBtn.disabled = false;
    }
};

window.HomePage = HomePage;
