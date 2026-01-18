// Main Application Logic

// State
let currentMarkdown = '';
let currentFilename = '';
window.currentView = 'split'; // 'markdown', 'preview', 'split' - default is split

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
    <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      ${type === 'success' ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>' : ''}
      ${type === 'error' ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>' : ''}
      ${type === 'info' ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>' : ''}
    </svg>
    <span>${message}</span>
  `;

    container.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Make showToast globally available
window.showToast = showToast;

/**
 * Set current view mode
 */
function setView(view) {
    window.currentView = view;

    const markdownPanel = document.getElementById('markdown-panel');
    const previewPanel = document.getElementById('preview-panel');
    const contentPanels = document.getElementById('content-panels');

    if (!markdownPanel || !previewPanel || !contentPanels) return;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.id === `tab-${view}`);
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
}

/**
 * Handle convert button click
 */
async function handleConvert() {
    const files = window.fileUpload?.getUploadedFiles() || [];

    if (files.length === 0) {
        showToast(window.i18n?.t('toast.noFiles') || 'Please select files first', 'error');
        return;
    }

    // Show progress section
    const progressSection = document.getElementById('progress-section');
    const resultSection = document.getElementById('result-section');
    const convertBtn = document.getElementById('convert-btn');

    convertBtn.disabled = true;
    progressSection.classList.remove('hidden');

    // Display file count
    document.getElementById('progress-filename').textContent =
        files.length === 1 ? files[0].name : `${files.length} dosya`;

    const progressBar = document.getElementById('progress-bar');

    try {
        // Update all file statuses
        files.forEach((_, i) => window.fileUpload.updateFileStatus(i, 'converting'));

        // Get selected model
        const modelSelect = document.getElementById('model-select');
        const selectedModel = modelSelect ? modelSelect.value : 'gemini-3-flash-preview';

        // Send all files together
        const result = await window.api.convertFiles(files, selectedModel, (progress) => {
            progressBar.style.width = `${progress}%`;
        });

        if (result.success) {
            currentMarkdown = result.markdown;
            currentFilename = result.filename || (files.length === 1 ? files[0].name : 'combined');

            // Update editor
            const editor = document.getElementById('markdown-editor');
            editor.value = currentMarkdown;

            // Update preview
            window.preview.updatePreview(currentMarkdown);
            window.preview.updateCharCount(currentMarkdown);

            // Show result section
            progressSection.classList.add('hidden');
            resultSection.classList.remove('hidden');

            // Update all file statuses
            files.forEach((_, i) => window.fileUpload.updateFileStatus(i, 'done'));
            showToast(window.i18n?.t('toast.conversionComplete') || 'Conversion complete!', 'success');

        } else {
            throw new Error(result.error);
        }

    } catch (error) {
        console.error('Conversion error:', error);
        files.forEach((_, i) => window.fileUpload.updateFileStatus(i, 'error'));
        showToast(error.message || window.i18n?.t('toast.conversionFailed') || 'Conversion failed', 'error');
        progressSection.classList.add('hidden');
    }

    convertBtn.disabled = false;
}

/**
 * Toggle theme
 */
function toggleTheme() {
    document.documentElement.classList.toggle('light');
    const isLight = document.documentElement.classList.contains('light');

    // Update icons
    document.querySelector('.sun-icon')?.classList.toggle('hidden', !isLight);
    document.querySelector('.moon-icon')?.classList.toggle('hidden', isLight);

    // Save preference
    localStorage.setItem('doc2md-theme', isLight ? 'light' : 'dark');
}

/**
 * Initialize theme from storage
 */
function initTheme() {
    const saved = localStorage.getItem('doc2md-theme');
    if (saved === 'light') {
        document.documentElement.classList.add('light');
        document.querySelector('.sun-icon')?.classList.remove('hidden');
        document.querySelector('.moon-icon')?.classList.add('hidden');
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Theme
    initTheme();
    document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

    // Convert button
    document.getElementById('convert-btn')?.addEventListener('click', handleConvert);

    // View tabs
    document.getElementById('tab-markdown')?.addEventListener('click', () => setView('markdown'));
    document.getElementById('tab-preview')?.addEventListener('click', () => setView('preview'));
    document.getElementById('tab-split')?.addEventListener('click', () => setView('split'));

    // Copy button
    document.getElementById('copy-btn')?.addEventListener('click', () => {
        const markdown = document.getElementById('markdown-editor')?.value || '';
        window.preview.copyToClipboard(markdown);
    });

    // Download MD button
    document.getElementById('download-md-btn')?.addEventListener('click', () => {
        const markdown = document.getElementById('markdown-editor')?.value || '';
        window.preview.downloadMarkdown(markdown, currentFilename);
    });

    // Download PDF button
    document.getElementById('download-pdf-btn')?.addEventListener('click', async () => {
        const markdown = document.getElementById('markdown-editor')?.value || '';
        await window.preview.downloadPdf(markdown, currentFilename);
    });

    // Editor sync with preview
    document.getElementById('markdown-editor')?.addEventListener('input', (e) => {
        const markdown = e.target.value;
        window.preview.updatePreview(markdown);
        window.preview.updateCharCount(markdown);
    });

    // Synchronized scrolling in split view
    const editor = document.getElementById('markdown-editor');
    const previewContent = document.getElementById('preview-content');
    let isScrolling = false;

    if (editor && previewContent) {
        editor.addEventListener('scroll', () => {
            if (isScrolling || window.currentView !== 'split') return;
            isScrolling = true;

            const scrollPercentage = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
            previewContent.scrollTop = scrollPercentage * (previewContent.scrollHeight - previewContent.clientHeight);

            setTimeout(() => isScrolling = false, 50);
        });

        previewContent.addEventListener('scroll', () => {
            if (isScrolling || window.currentView !== 'split') return;
            isScrolling = true;

            const scrollPercentage = previewContent.scrollTop / (previewContent.scrollHeight - previewContent.clientHeight);
            editor.scrollTop = scrollPercentage * (editor.scrollHeight - editor.clientHeight);

            setTimeout(() => isScrolling = false, 50);
        });
    }

    // Health check
    window.api?.healthCheck().then(ok => {
        if (!ok) {
            showToast('Sunucu bağlantısı kurulamadı', 'error');
        }
    });
});
