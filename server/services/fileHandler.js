const mimeTypes = require('../utils/mimeTypes');
const openaiService = require('./openai');
const googleDriveService = require('./googleDrive');
const s3Service = require('./s3');

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
        formatInfo: mimeTypes.getFormatInfo(mimeType)
    };
}

/**
 * Office dosyası mı kontrol eder
 * @param {string} mimeType - MIME tipi
 * @returns {boolean}
 */
function isOfficeFile(mimeType) {
    return mimeTypes.needsConversion(mimeType);
}

/**
 * Tek dosyayı işler ve API için hazır hale getirir
 * @param {object} file - Multer file object
 * @param {string} [s3Url] - Optional S3 URL for the file
 * @returns {Promise<{buffer: Buffer, mimeType: string, name: string, s3Url?: string}>}
 */
async function prepareFile(file, s3Url = null) {
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
                'Office dosyalarını (DOCX, PPTX, XLSX) işlemek için "npm run auth" komutu ile giriş yapın.'
            );
        }

        console.log(`📄 Office dosyası PDF'e dönüştürülüyor: ${originalname}`);

        processBuffer = await googleDriveService.convertToPdf(
            buffer,
            mimetype,
            analysis.formatInfo.googleMime
        );
        processMimeType = 'application/pdf';

        // Office dosyası dönüştürüldükten sonra S3 URL geçersiz olur
        s3Url = null;
    }

    return {
        buffer: processBuffer,
        mimeType: processMimeType,
        name: originalname,
        s3Url: s3Url
    };
}

/**
 * Birden fazla dosyayı tek bir API çağrısı ile markdown'a dönüştürür
 * @param {Array} files - Multer file objects array
 * @param {string} model - Model name
 * @param {function} onChunk - Optional callback for streaming chunks
 * @param {Object} s3UrlMap - Optional map of filename to S3 URL
 * @returns {Promise<string>} - Birleşik markdown içeriği
 */
async function processMultipleFiles(files, model, onChunk = null, s3UrlMap = {}) {
    // Tüm dosyaları hazırla
    const preparedFiles = [];

    for (const file of files) {
        // S3 URL varsa kullan
        const s3Url = s3UrlMap[file.originalname] || null;
        const prepared = await prepareFile(file, s3Url);
        preparedFiles.push(prepared);
    }

    // OpenAI ile birleşik markdown al
    const markdown = await openaiService.convertMultipleToMarkdown(preparedFiles, model, onChunk);

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
    getSupportedFormats,
    isOfficeFile
};
