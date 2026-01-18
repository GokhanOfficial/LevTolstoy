// Internationalization (i18n) - EN/TR Support

const translations = {
    tr: {
        // Upload Section
        'upload.title': 'Dosyalarınızı sürükleyip bırakın',
        'upload.subtitle': 'veya tıklayarak seçin',

        // Convert
        'convert.button': 'Dönüştürmeyi Başlat',

        // Progress
        'progress.converting': 'Dönüştürülüyor...',
        'progress.processing': 'İşleniyor:',

        // Tabs
        'tabs.preview': 'Önizleme',
        'tabs.split': 'Bölünmüş',

        // Actions
        'actions.copy': 'Kopyala',
        'actions.download': 'İndir (.md)',
        'actions.downloadMd': '.md',
        'actions.downloadPdf': '.pdf',

        // Navigation
        'nav.converter': 'Metinleştirici',
        'nav.editor': 'MD to PDF',

        // Editor
        'editor.title': 'MD to PDF',

        // Options
        'options.advanced': 'Gelişmiş Seçenekler',
        'options.model': 'Yapay Zeka Modeli',
        'models.gemini3flash': 'Gemini 3 Flash Preview (Önerilen)',
        'models.gemini25flash': 'Gemini 2.5 Flash',
        'models.gemini25flashlite': 'Gemini 2.5 Flash Lite',

        // Status
        'status.ready': 'Hazır',
        'status.converting': 'Dönüştürülüyor',
        'status.done': 'Tamamlandı',
        'status.error': 'Hata',

        // File info
        'file.characters': 'karakter',

        // Toast messages
        'toast.copied': 'Panoya kopyalandı!',
        'toast.downloadStarted': 'İndirme başladı',
        'toast.pdfGenerating': 'PDF oluşturuluyor...',
        'toast.pdfReady': 'PDF hazır!',
        'toast.conversionComplete': 'Dönüştürme tamamlandı!',
        'toast.conversionFailed': 'Dönüştürme başarısız',
        'toast.noFiles': 'Lütfen önce dosya seçin',
        'toast.unsupportedFormat': 'Desteklenmeyen dosya formatı',

        // Errors
        'errors.noFile': 'Dosya yüklenmedi',
        'errors.unsupportedFormat': 'Desteklenmeyen dosya formatı',
        'errors.conversionFailed': 'Dönüştürme sırasında hata oluştu',
        'errors.serverError': 'Sunucu hatası'
    },

    en: {
        // Upload Section
        'upload.title': 'Drag and drop your files',
        'upload.subtitle': 'or click to select',

        // Convert
        'convert.button': 'Start Conversion',

        // Progress
        'progress.converting': 'Converting...',
        'progress.processing': 'Processing:',

        // Tabs
        'tabs.preview': 'Preview',
        'tabs.split': 'Split View',

        // Actions
        'actions.copy': 'Copy',
        'actions.download': 'Download (.md)',
        'actions.downloadMd': '.md',
        'actions.downloadPdf': '.pdf',

        // Navigation
        'nav.converter': 'Textifier',
        'nav.editor': 'MD to PDF',

        // Editor
        'editor.title': 'MD to PDF',

        // Options
        'options.advanced': 'Advanced Options',
        'options.model': 'AI Model',
        'models.gemini3flash': 'Gemini 3 Flash Preview (Recommended)',
        'models.gemini25flash': 'Gemini 2.5 Flash',
        'models.gemini25flashlite': 'Gemini 2.5 Flash Lite',

        // Status
        'status.ready': 'Ready',
        'status.converting': 'Converting',
        'status.done': 'Done',
        'status.error': 'Error',

        // File info
        'file.characters': 'characters',

        // Toast messages
        'toast.copied': 'Copied to clipboard!',
        'toast.downloadStarted': 'Download started',
        'toast.pdfReady': 'PDF ready',
        'toast.conversionComplete': 'Conversion complete!',
        'toast.conversionFailed': 'Conversion failed',
        'toast.noFiles': 'Please select files first',
        'toast.unsupportedFormat': 'Unsupported file format',

        // Errors
        'errors.noFile': 'No file uploaded',
        'errors.unsupportedFormat': 'Unsupported file format',
        'errors.conversionFailed': 'Error during conversion',
        'errors.serverError': 'Server error'
    }
};

// Current language
let currentLang = localStorage.getItem('doc2md-lang') || 'tr';

/**
 * Get translation for a key
 */
function t(key) {
    return translations[currentLang][key] || translations['tr'][key] || key;
}

/**
 * Set the current language
 */
function setLanguage(lang) {
    if (!translations[lang]) return;

    currentLang = lang;
    localStorage.setItem('doc2md-lang', lang);

    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });

    // Update language buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.id === `lang-${lang}`);
    });

    // Update html lang attribute
    document.documentElement.lang = lang;

    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
}

/**
 * Get current language
 */
function getLanguage() {
    return currentLang;
}

// Initialize language on load
document.addEventListener('DOMContentLoaded', () => {
    // Set up language switcher buttons
    document.getElementById('lang-tr')?.addEventListener('click', () => setLanguage('tr'));
    document.getElementById('lang-en')?.addEventListener('click', () => setLanguage('en'));

    // Apply saved language
    setLanguage(currentLang);
});

// Export for use in other modules
window.i18n = { t, setLanguage, getLanguage };
