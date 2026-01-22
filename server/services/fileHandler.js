const mimeTypes = require('../utils/mimeTypes');
const geminiService = require('./gemini');
const googleDriveService = require('./googleDrive');

/**
 * Dosya tipini ve işlem yolunu belirler
 * @param {string} mimeType - Dosya MIME tipi
 * @returns {object} - { supported, direct, needsConversion, formatInfo }
 */
function analyzeFile(mimeType) {
    return {
        supported: mimeTypes.isSupported(mimeType),
        direct: mimeTypes.isDirect(mimeType),
        needsConversion: mimeTypes.needsConversion(mimeType),
        needsEncoding: mimeTypes.needsEncoding(mimeType),
        formatInfo: mimeTypes.getFormatInfo(mimeType)
    };
}

/**
 * Tek dosyayı işler ve Gemini için hazır hale getirir
 * @param {object} file - Multer file object
 * @returns {Promise<{buffer: Buffer, mimeType: string, name: string}>}
 */
async function prepareFile(file, progressCallback = null) {
    const { buffer, mimetype, originalname } = file;
    const analysis = analyzeFile(mimetype);

    if (!analysis.supported) {
        throw new Error(`Desteklenmeyen dosya formatı: ${originalname} (${mimetype})`);
    }

    let processBuffer = buffer;
    let processMimeType = mimetype;

    // Office dosyaları için önce PDF'e dönüştür
    if (analysis.needsConversion) {
        if (!googleDriveService.isConfigured()) {
            throw new Error(
                `${analysis.formatInfo.name} dosyaları için Google Drive API yapılandırması gerekli. ` +
                '"npm run auth" komutu ile giriş yapın.'
            );
        }

        processBuffer = await googleDriveService.convertToPdf(
            buffer,
            mimetype,
            analysis.formatInfo.googleMime
        );
        processMimeType = 'application/pdf';
    }

    // Media dosyaları için FFmpeg ile encode et
    if (analysis.needsEncoding) {
        const mediaEncoder = require('./mediaEncoder');

        if (!mediaEncoder.isAvailable()) {
            throw new Error(
                `${analysis.formatInfo.name} dosyaları için FFmpeg gerekli. ` +
                'FFmpeg kurulu değil veya bulunamıyor.'
            );
        }

        console.log(`🔄 Encoding: ${originalname} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);

        const encoded = await mediaEncoder.encodeMedia(buffer, mimetype, buffer.length, progressCallback);
        processBuffer = encoded.buffer;
        processMimeType = encoded.mimeType;
    }

    return {
        buffer: processBuffer,
        mimeType: processMimeType,
        name: originalname
    };
}

/**
 * Birden fazla dosyayı tek bir Gemini çağrısı ile markdown'a dönüştürür
 * @param {Array} files - Multer file objects array
 * @param {string} model - Gemini model name
 * @param {function} onChunk - Optional callback for streaming chunks
 * @returns {Promise<string>} - Birleşik markdown içeriği
 */
async function processMultipleFiles(files, model, onChunk = null, onProgress = null) {
    // Tüm dosyaları hazırla
    const preparedFiles = [];

    for (const file of files) {
        const prepared = await prepareFile(file, onProgress);
        preparedFiles.push(prepared);
    }

    // Gemini ile birleşik markdown al
    const markdown = await geminiService.convertMultipleToMarkdown(preparedFiles, model, onChunk);

    return markdown;
}

/**
 * Tek dosyayı markdown'a dönüştürür (geriye uyumluluk)
 * @param {Buffer} fileBuffer - Dosya içeriği
 * @param {string} mimeType - Dosya MIME tipi
 * @returns {Promise<string>} - Markdown içeriği
 */
async function processFile(fileBuffer, mimeType) {
    const fakeFile = { buffer: fileBuffer, mimetype: mimeType, originalname: 'file' };
    return processMultipleFiles([fakeFile]);
}

/**
 * Desteklenen formatları döndürür
 */
function getSupportedFormats() {
    const formats = [];

    Object.entries(mimeTypes.SUPPORTED_FORMATS.direct).forEach(([mime, info]) => {
        formats.push({
            mimeType: mime,
            extension: info.ext,
            name: info.name,
            type: 'direct'
        });
    });

    Object.entries(mimeTypes.SUPPORTED_FORMATS.convert).forEach(([mime, info]) => {
        formats.push({
            mimeType: mime,
            extension: info.ext,
            name: info.name,
            type: 'convert',
            requiresDriveApi: true
        });
    });

    return formats;
}

module.exports = {
    analyzeFile,
    prepareFile,
    processFile,
    processMultipleFiles,
    getSupportedFormats
};
