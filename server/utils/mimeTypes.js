// Desteklenen dosya formatları

const SUPPORTED_FORMATS = {
    // Direkt API'ye gönderilebilen formatlar
    direct: {
        'application/pdf': { ext: '.pdf', name: 'PDF' },
        'image/png': { ext: '.png', name: 'PNG' },
        'image/jpeg': { ext: '.jpg', name: 'JPEG' },
        'image/webp': { ext: '.webp', name: 'WebP' },
        'image/gif': { ext: '.gif', name: 'GIF' },

        // Audio (directly supported)
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
    },

    // FFmpeg ile MP3/MP4'e dönüştürülmesi gereken formatlar
    encode: {
        // Audio formats -> MP3
        'audio/mp4': { ext: '.m4a', name: 'M4A', outputFormat: 'mp3', outputMime: 'audio/mpeg' },
        'audio/aac': { ext: '.aac', name: 'AAC', outputFormat: 'mp3', outputMime: 'audio/mpeg' },
        'audio/aacp': { ext: '.aac', name: 'AAC+', outputFormat: 'mp3', outputMime: 'audio/mpeg' },
        'audio/opus': { ext: '.opus', name: 'Opus', outputFormat: 'mp3', outputMime: 'audio/mpeg' },
        'audio/flac': { ext: '.flac', name: 'FLAC', outputFormat: 'mp3', outputMime: 'audio/mpeg' },
        'audio/ogg': { ext: '.ogg', name: 'OGG', outputFormat: 'mp3', outputMime: 'audio/mpeg' },
        'audio/x-flac': { ext: '.flac', name: 'FLAC', outputFormat: 'mp3', outputMime: 'audio/mpeg' },
        'audio/x-aac': { ext: '.aac', name: 'AAC', outputFormat: 'mp3', outputMime: 'audio/mpeg' },
        'audio/x-m4a': { ext: '.m4a', name: 'M4A', outputFormat: 'mp3', outputMime: 'audio/mpeg' },
        'audio/x-opus': { ext: '.opus', name: 'Opus', outputFormat: 'mp3', outputMime: 'audio/mpeg' },
        'audio/webm': { ext: '.weba', name: 'WebM Audio', outputFormat: 'mp3', outputMime: 'audio/mpeg' },

        // Video formats -> MP4
        'video/x-matroska': { ext: '.mkv', name: 'MKV', outputFormat: 'mp4', outputMime: 'video/mp4' },
        'video/3gpp': { ext: '.3gp', name: '3GP', outputFormat: 'mp4', outputMime: 'video/mp4' },
        'video/webm': { ext: '.webm', name: 'WebM', outputFormat: 'mp4', outputMime: 'video/mp4' },
        'video/x-m4v': { ext: '.m4v', name: 'M4V', outputFormat: 'mp4', outputMime: 'video/mp4' },
        'video/avi': { ext: '.avi', name: 'AVI', outputFormat: 'mp4', outputMime: 'video/mp4' },
        'video/x-msvideo': { ext: '.avi', name: 'AVI', outputFormat: 'mp4', outputMime: 'video/mp4' }
    }
};

// Tüm desteklenen MIME tipleri
const ALL_SUPPORTED_MIMES = [
    ...Object.keys(SUPPORTED_FORMATS.direct),
    ...Object.keys(SUPPORTED_FORMATS.convert),
    ...Object.keys(SUPPORTED_FORMATS.encode)
];

// Dosya uzantılarından MIME tipi bulma
const EXTENSION_TO_MIME = {};
Object.entries(SUPPORTED_FORMATS.direct).forEach(([mime, info]) => {
    EXTENSION_TO_MIME[info.ext] = mime;
});
Object.entries(SUPPORTED_FORMATS.convert).forEach(([mime, info]) => {
    EXTENSION_TO_MIME[info.ext] = mime;
});
Object.entries(SUPPORTED_FORMATS.encode).forEach(([mime, info]) => {
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
 * MIME tipinin dönüştürme gerektirip gerektirmediğini kontrol eder (Google Drive)
 */
function needsConversion(mimeType) {
    return mimeType in SUPPORTED_FORMATS.convert;
}

/**
 * MIME tipinin FFmpeg ile kodlama gerektirip gerektirmediğini kontrol eder
 */
function needsEncoding(mimeType) {
    return mimeType in SUPPORTED_FORMATS.encode;
}

/**
 * Format bilgisini döndürür
 */
function getFormatInfo(mimeType) {
    return SUPPORTED_FORMATS.direct[mimeType] ||
           SUPPORTED_FORMATS.convert[mimeType] ||
           SUPPORTED_FORMATS.encode[mimeType] ||
           null;
}

module.exports = {
    SUPPORTED_FORMATS,
    ALL_SUPPORTED_MIMES,
    EXTENSION_TO_MIME,
    isSupported,
    isDirect,
    needsConversion,
    needsEncoding,
    getFormatInfo
};
