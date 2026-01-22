// Desteklenen dosya formatları

const SUPPORTED_FORMATS = {
    // Direkt Gemini'ye gönderilebilen formatlar
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
        'text/plain': { ext: '.txt', name: 'Text' },

        // Video
        'video/mov': { ext: '.mov', name: 'MOV' },
        'video/quicktime': { ext: '.mov', name: 'MOV' },
        'video/mpeg': { ext: '.mpeg', name: 'MPEG' },
        'video/mpg': { ext: '.mpg', name: 'MPEG' },
        'video/mpegps': { ext: '.mpg', name: 'MPEG-PS' },
        'video/mp4': { ext: '.mp4', name: 'MP4' },
        'video/avi': { ext: '.avi', name: 'AVI' },
        'video/x-msvideo': { ext: '.avi', name: 'AVI' },
        'video/wmv': { ext: '.wmv', name: 'WMV' },
        'video/x-ms-wmv': { ext: '.wmv', name: 'WMV' },
        'video/flv': { ext: '.flv', name: 'FLV' },
        'video/x-flv': { ext: '.flv', name: 'FLV' }
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
        },
        'application/vnd.ms-excel': {
            ext: '.xls',
            name: 'Excel (Legacy)',
            googleMime: 'application/vnd.google-apps.spreadsheet'
        },
        'text/csv': {
            ext: '.csv',
            name: 'CSV',
            googleMime: 'application/vnd.google-apps.spreadsheet'
        }
    },

    // FFmpeg ile encode edilmesi gereken formatlar
    encode: {
        // Audio - encode to MP3
        'audio/m4a': { ext: '.m4a', name: 'M4A', targetMime: 'audio/mpeg' },
        'audio/x-m4a': { ext: '.m4a', name: 'M4A', targetMime: 'audio/mpeg' },
        'audio/aac': { ext: '.aac', name: 'AAC', targetMime: 'audio/mpeg' },
        'audio/opus': { ext: '.opus', name: 'Opus', targetMime: 'audio/mpeg' },
        'audio/ogg': { ext: '.ogg', name: 'OGG', targetMime: 'audio/mpeg' },
        'audio/flac': { ext: '.flac', name: 'FLAC', targetMime: 'audio/mpeg' },
        'audio/x-flac': { ext: '.flac', name: 'FLAC', targetMime: 'audio/mpeg' },
        'audio/webm': { ext: '.weba', name: 'WebM Audio', targetMime: 'audio/mpeg' },

        // Video - encode to MP4
        'video/x-matroska': { ext: '.mkv', name: 'MKV', targetMime: 'video/mp4' },
        'video/3gpp': { ext: '.3gp', name: '3GP', targetMime: 'video/mp4' },
        'video/3gpp2': { ext: '.3g2', name: '3G2', targetMime: 'video/mp4' },
        'video/webm': { ext: '.webm', name: 'WebM', targetMime: 'video/mp4' }
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
 * MIME tipinin dönüştürme gerektirip gerektirmediğini kontrol eder
 */
function needsConversion(mimeType) {
    return mimeType in SUPPORTED_FORMATS.convert;
}

/**
 * MIME tipinin encoding gerektirip gerektirmediğini kontrol eder
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
