// Desteklenen dosya formatları (Video formatları OpenAI API'de desteklenmediği için kaldırıldı)

const SUPPORTED_FORMATS = {
    // Direkt API'ye gönderilebilen formatlar
    direct: {
        'application/pdf': { ext: '.pdf', name: 'PDF' },
        'image/png': { ext: '.png', name: 'PNG' },
        'image/jpeg': { ext: '.jpg', name: 'JPEG' },
        'image/webp': { ext: '.webp', name: 'WebP' },
        'image/gif': { ext: '.gif', name: 'GIF' },

        // Audio
        'audio/mpeg': { ext: '.mp3', name: 'MP3' },
        'audio/mp3': { ext: '.mp3', name: 'MP3' },
        'audio/wav': { ext: '.wav', name: 'WAV' },

        // Text
        'text/plain': { ext: '.txt', name: 'Text' }
    },

    // Google Drive ile PDF'e dönüştürülmesi gereken formatlar
    convert: {
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
            ext: '.pptx',
            name: 'PowerPoint',
            googleMime: 'application/vnd.google-apps.presentation'
        },
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
            ext: '.docx',
            name: 'Word',
            googleMime: 'application/vnd.google-apps.document'
        },
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
            ext: '.xlsx',
            name: 'Excel',
            googleMime: 'application/vnd.google-apps.spreadsheet'
        },
        'application/vnd.ms-powerpoint': {
            ext: '.ppt',
            name: 'PowerPoint (Legacy)',
            googleMime: 'application/vnd.google-apps.presentation'
        },
        'application/msword': {
            ext: '.doc',
            name: 'Word (Legacy)',
            googleMime: 'application/vnd.google-apps.document'
        }
    }
};

// Tüm desteklenen MIME tipleri
const ALL_SUPPORTED_MIMES = [
    ...Object.keys(SUPPORTED_FORMATS.direct),
    ...Object.keys(SUPPORTED_FORMATS.convert)
];

// Dosya uzantılarından MIME tipi bulma
const EXTENSION_TO_MIME = {};
Object.entries(SUPPORTED_FORMATS.direct).forEach(([mime, info]) => {
    EXTENSION_TO_MIME[info.ext] = mime;
});
Object.entries(SUPPORTED_FORMATS.convert).forEach(([mime, info]) => {
    EXTENSION_TO_MIME[info.ext] = mime;
});

/**
 * MIME tipinin desteklenip desteklenmediğini kontrol eder
 */
function isSupported(mimeType) {
    return ALL_SUPPORTED_MIMES.includes(mimeType);
}

/**
 * MIME tipinin direkt işlenip işlenemeyeceğini kontrol eder
 */
function isDirect(mimeType) {
    return mimeType in SUPPORTED_FORMATS.direct;
}

/**
 * MIME tipinin dönüştürme gerektirip gerektirmediğini kontrol eder
 */
function needsConversion(mimeType) {
    return mimeType in SUPPORTED_FORMATS.convert;
}

/**
 * Format bilgisini döndürür
 */
function getFormatInfo(mimeType) {
    return SUPPORTED_FORMATS.direct[mimeType] || SUPPORTED_FORMATS.convert[mimeType] || null;
}

module.exports = {
    SUPPORTED_FORMATS,
    ALL_SUPPORTED_MIMES,
    EXTENSION_TO_MIME,
    isSupported,
    isDirect,
    needsConversion,
    getFormatInfo
};
