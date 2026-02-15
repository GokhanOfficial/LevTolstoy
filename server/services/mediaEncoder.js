const ffmpeg = require('fluent-ffmpeg');
const config = require('../config');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { Readable } = require('stream');
const { promisify } = require('util');
const { execFile } = require('child_process');
const execFilePromise = promisify(execFile);
const { needsEncoding: needsEncodingFromMimeTypes } = require('../utils/mimeTypes');

let ffmpegAvailable = false;
let ffmpegPath = null;

const TARGET_SIZE_BYTES = 95 * 1024 * 1024;
const GEMINI_MAX_SIZE = 100 * 1024 * 1024;

async function checkFfmpeg() {
    try {
        const ffmpegCmd = config.ffmpeg?.path || 'ffmpeg';
        const { stdout } = await execFilePromise(ffmpegCmd, ['-version']);

        if (stdout.includes('ffmpeg version')) {
            ffmpegAvailable = true;
            ffmpegPath = ffmpegCmd;
            console.log(`✅ FFmpeg bulundu: ${ffmpegCmd}`);
            ffmpeg.setFfmpegPath(ffmpegCmd);
            return true;
        }
    } catch (error) {
        ffmpegAvailable = false;
        console.warn(`⚠️ FFmpeg bulunamadı. M4A, Opus, MKV vb. formatlar devre dışı.`);
    }
    return false;
}

function isAvailable() {
    return ffmpegAvailable;
}

function needsEncoding(mimeType) {
    return needsEncodingFromMimeTypes(mimeType);
}

function needsCompression(fileSize) {
    return fileSize > GEMINI_MAX_SIZE;
}

function calculateTargetBitrate(currentSize, durationSeconds, targetSize = TARGET_SIZE_BYTES) {
    if (!durationSeconds || durationSeconds <= 0) return null;
    const targetBitrate = Math.floor((targetSize * 8) / (durationSeconds * 1000));
    return Math.max(32, targetBitrate);
}

function getMediaInfo(buffer) {
    return new Promise((resolve, reject) => {
        const stream = Readable.from(buffer);
        ffmpeg.ffprobe(stream, (err, metadata) => {
            if (err) return reject(err);
            resolve({
                duration: metadata.format.duration || 0,
                bitrate: Math.floor((metadata.format.bit_rate || 0) / 1000)
            });
        });
    });
}

/**
 * Generate a unique filename using crypto for avoiding race conditions
 */
function generateUniqueFilename(prefix, extension) {
    const randomBytes = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    return `${prefix}-${timestamp}-${randomBytes}${extension}`;
}

function encodeAudio(buffer, fileSize, progressCallback = null) {
    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, generateUniqueFilename('ffmpeg-input', '.tmp'));
    const outputPath = path.join(tempDir, generateUniqueFilename('ffmpeg-output', '.mp3'));

    return new Promise((resolve, reject) => {
        let startTime = Date.now();
        let lastProgressTime = 0;
        let timeoutId = null;
        let encodingProcess = null;

        const cleanup = () => {
            if (timeoutId) clearTimeout(timeoutId);
            try { fs.unlinkSync(inputPath); } catch (e) { }
            try { fs.unlinkSync(outputPath); } catch (e) { }
            if (encodingProcess) {
                try { encodingProcess.kill(); } catch (e) { }
            }
        };

        const handleTimeout = () => {
            cleanup();
            reject(new Error('Encoding timeout exceeded'));
        };

        // Set timeout from config
        const maxTimeout = config.ffmpeg?.maxEncodingTimeMs || 300000; // 5 minutes default
        timeoutId = setTimeout(handleTimeout, maxTimeout);

        // Write input file synchronously
        try {
            fs.writeFileSync(inputPath, buffer);
        } catch (error) {
            cleanup();
            reject(error);
            return;
        }

        // Determine target bitrate
        let targetBitrate = 128;
        const bitratePromise = fileSize > GEMINI_MAX_SIZE
            ? getMediaInfo(buffer)
                .then(info => {
                    const calculatedBitrate = calculateTargetBitrate(fileSize, info.duration);
                    if (calculatedBitrate) targetBitrate = Math.min(calculatedBitrate, 128);
                })
                .catch(() => { /* Use default bitrate on error */ })
            : Promise.resolve();

        bitratePromise.then(() => {
            encodingProcess = ffmpeg(inputPath)
                .audioCodec('libmp3lame')
                .audioBitrate(targetBitrate)
                .audioChannels(2)
                .audioFrequency(44100)
                .format('mp3')
                .on('start', () => { startTime = Date.now(); })
                .on('progress', (progress) => {
                    const now = Date.now();
                    if (now - lastProgressTime < 1000) return;
                    lastProgressTime = now;

                    const percent = progress.percent || 0;
                    const elapsed = (now - startTime) / 1000;
                    const eta = percent > 0 ? Math.round((elapsed / percent) * (100 - percent)) : null;

                    if (progressCallback) {
                        progressCallback({
                            percent: Math.min(Math.max(percent, 0), 100),
                            eta,
                            type: 'encoding'
                        });
                    }
                })
                .on('error', (err) => {
                    cleanup();
                    reject(new Error(`Audio encoding failed: ${err.message}`));
                })
                .on('end', () => {
                    if (timeoutId) clearTimeout(timeoutId);
                    try {
                        const outputBuffer = fs.readFileSync(outputPath);
                        fs.unlinkSync(inputPath);
                        fs.unlinkSync(outputPath);

                        if (outputBuffer.length > GEMINI_MAX_SIZE) {
                            reject(new Error(`Encoded file still too large: ${(outputBuffer.length / 1024 / 1024).toFixed(1)}MB`));
                        } else {
                            resolve(outputBuffer);
                        }
                    } catch (err) {
                        cleanup();
                        reject(err);
                    }
                })
                .save(outputPath);
        }).catch(error => {
            cleanup();
            reject(error);
        });
    });
}

function encodeVideo(buffer, fileSize, progressCallback = null) {
    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, generateUniqueFilename('ffmpeg-input', '.tmp'));
    const outputPath = path.join(tempDir, generateUniqueFilename('ffmpeg-output', '.mp4'));

    return new Promise((resolve, reject) => {
        let startTime = Date.now();
        let lastProgressTime = 0;
        let timeoutId = null;
        let encodingProcess = null;

        const cleanup = () => {
            if (timeoutId) clearTimeout(timeoutId);
            try { fs.unlinkSync(inputPath); } catch (e) { }
            try { fs.unlinkSync(outputPath); } catch (e) { }
            if (encodingProcess) {
                try { encodingProcess.kill(); } catch (e) { }
            }
        };

        const handleTimeout = () => {
            cleanup();
            reject(new Error('Encoding timeout exceeded'));
        };

        // Set timeout from config
        const maxTimeout = config.ffmpeg?.maxEncodingTimeMs || 300000; // 5 minutes default
        timeoutId = setTimeout(handleTimeout, maxTimeout);

        // Write input file synchronously
        try {
            fs.writeFileSync(inputPath, buffer);
        } catch (error) {
            cleanup();
            reject(error);
            return;
        }

        // Determine encoding parameters
        let videoBitrate = '1000k';
        let audioBitrate = '128k';
        let crf = 23;

        const bitratePromise = fileSize > GEMINI_MAX_SIZE
            ? getMediaInfo(buffer)
                .then(info => {
                    const calculatedBitrate = calculateTargetBitrate(fileSize, info.duration);
                    if (calculatedBitrate) {
                        videoBitrate = `${Math.max(500, Math.floor(calculatedBitrate * 0.9))}k`;
                        audioBitrate = '96k';
                        crf = 28;
                    }
                })
                .catch(() => { /* Use default parameters on error */ })
            : Promise.resolve();

        bitratePromise.then(() => {
            encodingProcess = ffmpeg(inputPath)
                .videoCodec('libx264')
                .videoBitrate(videoBitrate)
                .outputOptions([`-crf ${crf}`, '-preset fast', '-movflags +faststart'])
                .audioCodec('aac')
                .audioBitrate(audioBitrate)
                .format('mp4')
                .on('start', () => { startTime = Date.now(); })
                .on('progress', (progress) => {
                    const now = Date.now();
                    if (now - lastProgressTime < 1000) return;
                    lastProgressTime = now;

                    const percent = progress.percent || 0;
                    const elapsed = (now - startTime) / 1000;
                    const eta = percent > 0 ? Math.round((elapsed / percent) * (100 - percent)) : null;

                    if (progressCallback) {
                        progressCallback({
                            percent: Math.min(Math.max(percent, 0), 100),
                            eta,
                            type: 'encoding'
                        });
                    }
                })
                .on('error', (err) => {
                    cleanup();
                    reject(new Error(`Video encoding failed: ${err.message}`));
                })
                .on('end', () => {
                    if (timeoutId) clearTimeout(timeoutId);
                    try {
                        const outputBuffer = fs.readFileSync(outputPath);
                        fs.unlinkSync(inputPath);
                        fs.unlinkSync(outputPath);

                        if (outputBuffer.length > GEMINI_MAX_SIZE) {
                            reject(new Error(`Encoded video still too large: ${(outputBuffer.length / 1024 / 1024).toFixed(1)}MB`));
                        } else {
                            resolve(outputBuffer);
                        }
                    } catch (err) {
                        cleanup();
                        reject(err);
                    }
                })
                .save(outputPath);
        }).catch(error => {
            cleanup();
            reject(error);
        });
    });
}

async function encodeMedia(buffer, mimeType, fileSize, progressCallback = null) {
    if (!ffmpegAvailable) {
        throw new Error('FFmpeg is not available. Cannot encode media files.');
    }

    let outputBuffer;
    let outputMime;

    if (mimeType.startsWith('audio/')) {
        outputBuffer = await encodeAudio(buffer, fileSize, progressCallback);
        outputMime = 'audio/mpeg';
    } else if (mimeType.startsWith('video/')) {
        outputBuffer = await encodeVideo(buffer, fileSize, progressCallback);
        outputMime = 'video/mp4';
    } else {
        throw new Error(`Unsupported media type for encoding: ${mimeType}`);
    }

    return {
        buffer: outputBuffer,
        mimeType: outputMime
    };
}

module.exports = {
    checkFfmpeg,
    isAvailable,
    needsEncoding,
    needsCompression,
    encodeMedia
};
