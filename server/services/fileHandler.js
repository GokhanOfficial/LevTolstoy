const fs = require('fs');
const mimeTypes = require('../utils/mimeTypes');
const openaiService = require('./openai');
const googleDriveService = require('./googleDrive');
const mediaEncoder = require('./mediaEncoder');

function analyzeFile(mimeType) {
    return {
        supported: mimeTypes.isSupported(mimeType),
        direct: mimeTypes.isDirect(mimeType),
        needsConversion: mimeTypes.needsConversion(mimeType),
        needsEncoding: mimeTypes.needsEncoding(mimeType),
        formatInfo: mimeTypes.getFormatInfo(mimeType)
    };
}

function isOfficeFile(mimeType) {
    return mimeTypes.needsConversion(mimeType);
}

function throwIfAborted(signal) {
    if (signal?.aborted) {
        throw new Error('Dönüştürme işlemi iptal edildi.');
    }
}

async function readFileInput(file) {
    if (file.buffer) return file.buffer;
    if (file.path) return fs.promises.readFile(file.path);
    throw new Error(`Dosya içeriği okunamadı: ${file.originalname}`);
}

async function getInputSize(file) {
    if (file.buffer) return file.buffer.length;
    if (file.path) {
        const stat = await fs.promises.stat(file.path);
        return stat.size;
    }
    return 0;
}

function isDirectAudio(mimeType) {
    return mimeType === 'audio/mpeg' || mimeType === 'audio/mp3' || mimeType === 'audio/wav' || mimeType === 'audio/x-wav' || mimeType === 'audio/ogg';
}

async function prepareFile(file, s3Url = null, options = {}) {
    const { mimetype, originalname } = file;
    const analysis = analyzeFile(mimetype);
    throwIfAborted(options.signal);

    if (!analysis.supported) {
        throw new Error(`Desteklenmeyen dosya formatı: ${originalname} (${mimetype})`);
    }

    let processBuffer = file.buffer || null;
    let processMimeType = mimetype;

    if (analysis.needsConversion) {
        if (!googleDriveService.isConfigured()) {
            throw new Error(
                `${analysis.formatInfo.name} dosyaları için Google Drive API yapılandırması gerekli. ` +
                'Office dosyalarını (DOCX, PPTX, XLSX) işlemek için "npm run auth" komutu ile giriş yapın.'
            );
        }

        console.log(`📄 Office dosyası PDF'e dönüştürülüyor: ${originalname}`);
        processBuffer = await readFileInput(file);
        throwIfAborted(options.signal);

        processBuffer = await googleDriveService.convertToPdf(
            processBuffer,
            mimetype,
            analysis.formatInfo.googleMime
        );
        processMimeType = 'application/pdf';
        s3Url = null;
    }

    const inputSize = await getInputSize(file);
    const needsAudioSizeReduction = isDirectAudio(mimetype) && inputSize > mediaEncoder.MAX_FILE_SIZE;

    if (analysis.needsEncoding || needsAudioSizeReduction || (mediaEncoder.isMp3Mime(mimetype) && file.path)) {
        console.log(`🎵 Medya dosyası kontrol ediliyor/dönüştürülüyor: ${originalname}`);

        try {
            let result;
            if (file.path && !processBuffer) {
                result = await mediaEncoder.encodePathToMp3(file.path, mimetype, {
                    signal: options.signal,
                    onProgress: options.onMediaProgress,
                    registerProcess: options.registerProcess
                });
                processBuffer = await fs.promises.readFile(result.filePath);
            } else {
                processBuffer = processBuffer || await readFileInput(file);
                result = await mediaEncoder.encodeMedia(processBuffer, mimetype, {
                    signal: options.signal,
                    registerProcess: options.registerProcess
                }, options.onMediaProgress);
                processBuffer = result.buffer;
            }

            throwIfAborted(options.signal);
            processMimeType = result.mimeType;
            console.log(`✅ Medya hazır: ${(result.size / 1024 / 1024).toFixed(2)}MB${result.bitrateKbps ? ` | ${result.bitrateKbps}kbps` : ''}`);
            s3Url = null;
        } catch (err) {
            throw new Error(`Medya dönüştürme hatası (${originalname}): ${err.message}`);
        }
    }

    if (!processBuffer) {
        processBuffer = await readFileInput(file);
    }

    return {
        buffer: processBuffer,
        mimeType: processMimeType,
        name: originalname,
        s3Url: s3Url
    };
}

async function processMultipleFiles(files, model, onChunk = null, s3UrlMap = {}, options = {}) {
    const preparedFiles = [];

    for (let i = 0; i < files.length; i++) {
        throwIfAborted(options.signal);
        const file = files[i];
        options.onFileStart?.({ file, index: i, total: files.length });
        const s3Url = s3UrlMap[file.originalname] || null;
        const prepared = await prepareFile(file, s3Url, options);
        preparedFiles.push(prepared);
    }

    throwIfAborted(options.signal);
    options.onAiStart?.();
    return openaiService.convertMultipleToMarkdown(preparedFiles, model, (chunk) => {
        throwIfAborted(options.signal);
        onChunk?.(chunk);
    });
}

async function processFile(fileBuffer, mimeType) {
    const fakeFile = { buffer: fileBuffer, mimetype: mimeType, originalname: 'file' };
    return processMultipleFiles([fakeFile]);
}

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

    Object.entries(mimeTypes.SUPPORTED_FORMATS.encode).forEach(([mime, info]) => {
        formats.push({
            mimeType: mime,
            extension: info.ext,
            name: info.name,
            type: 'encode',
            outputFormat: info.outputFormat,
            outputMime: info.outputMime,
            requiresFFmpeg: true
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
