const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Size constants
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB API limit
const TARGET_FILE_SIZE = 95 * 1024 * 1024; // 95MB safe margin

// Audio formats that need encoding to MP3
const AUDIO_FORMATS_TO_ENCODE = {
    'audio/mp4': { ext: '.m4a', name: 'M4A', outputFormat: 'mp3' },
    'audio/aac': { ext: '.aac', name: 'AAC', outputFormat: 'mp3' },
    'audio/aacp': { ext: '.aac', name: 'AAC+', outputFormat: 'mp3' },
    'audio/opus': { ext: '.opus', name: 'Opus', outputFormat: 'mp3' },
    'audio/flac': { ext: '.flac', name: 'FLAC', outputFormat: 'mp3' },
    'audio/ogg': { ext: '.ogg', name: 'OGG', outputFormat: 'mp3' },
    'audio/x-flac': { ext: '.flac', name: 'FLAC', outputFormat: 'mp3' },
    'audio/x-aac': { ext: '.aac', name: 'AAC', outputFormat: 'mp3' },
    'audio/x-m4a': { ext: '.m4a', name: 'M4A', outputFormat: 'mp3' },
    'audio/x-opus': { ext: '.opus', name: 'Opus', outputFormat: 'mp3' },
    'audio/webm': { ext: '.weba', name: 'WebM Audio', outputFormat: 'mp3' }
};

// Video formats that need encoding to MP4
const VIDEO_FORMATS_TO_ENCODE = {
    'video/x-matroska': { ext: '.mkv', name: 'MKV', outputFormat: 'mp4' },
    'video/3gpp': { ext: '.3gp', name: '3GP', outputFormat: 'mp4' },
    'video/webm': { ext: '.webm', name: 'WebM', outputFormat: 'mp4' },
    'video/x-m4v': { ext: '.m4v', name: 'M4V', outputFormat: 'mp4' },
    'video/avi': { ext: '.avi', name: 'AVI', outputFormat: 'mp4' },
    'video/x-msvideo': { ext: '.avi', name: 'AVI', outputFormat: 'mp4' }
};

// All formats that need encoding
const ALL_FORMATS_TO_ENCODE = {
    ...AUDIO_FORMATS_TO_ENCODE,
    ...VIDEO_FORMATS_TO_ENCODE
};

/**
 * Get FFmpeg executable path
 * @returns {string}
 */
function getFFmpegPath() {
    return process.env.FFMPEG_PATH || 'ffmpeg';
}

/**
 * Check if FFmpeg is available
 * @returns {Promise<boolean>}
 */
async function isFFmpegAvailable() {
    return new Promise((resolve) => {
        const ffmpeg = spawn(getFFmpegPath(), ['-version']);
        ffmpeg.on('error', () => resolve(false));
        ffmpeg.on('close', (code) => resolve(code === 0));
    });
}

/**
 * Check if a MIME type needs encoding
 * @param {string} mimeType
 * @returns {boolean}
 */
function needsEncoding(mimeType) {
    return mimeType in ALL_FORMATS_TO_ENCODE;
}

/**
 * Check if a MIME type is an audio format needing encoding
 * @param {string} mimeType
 * @returns {boolean}
 */
function isAudioFormat(mimeType) {
    return mimeType in AUDIO_FORMATS_TO_ENCODE;
}

/**
 * Check if a MIME type is a video format needing encoding
 * @param {string} mimeType
 * @returns {boolean}
 */
function isVideoFormat(mimeType) {
    return mimeType in VIDEO_FORMATS_TO_ENCODE;
}

/**
 * Get format info for a MIME type
 * @param {string} mimeType
 * @returns {object|null}
 */
function getFormatInfo(mimeType) {
    return ALL_FORMATS_TO_ENCODE[mimeType] || null;
}

/**
 * Calculate bitrate for target file size
 * @param {number} durationSeconds - Media duration in seconds
 * @param {number} targetSizeBytes - Target size in bytes
 * @param {string} type - 'audio' or 'video'
 * @returns {number} - Bitrate in kbps
 */
function calculateBitrate(durationSeconds, targetSizeBytes, type = 'audio') {
    // Leave some margin for container overhead (about 5%)
    const adjustedSize = targetSizeBytes * 0.95;
    // Calculate bitrate: (size in bits) / (duration in seconds) / 1000 = kbps
    const bitrateKbps = Math.floor((adjustedSize * 8) / durationSeconds / 1000);

    // Set reasonable limits based on type
    if (type === 'audio') {
        return Math.min(Math.max(bitrateKbps, 64), 320); // 64-320 kbps for audio
    } else {
        return Math.min(Math.max(bitrateKbps, 256), 8000); // 256-8000 kbps for video
    }
}

/**
 * Get media duration using ffprobe
 * @param {Buffer} buffer - Media buffer
 * @returns {Promise<number>} - Duration in seconds
 */
function getMediaDuration(buffer) {
    return new Promise((resolve, reject) => {
        const ffprobe = spawn('ffprobe', [
            '-i', 'pipe:0',
            '-show_entries', 'format=duration',
            '-v', 'quiet',
            '-of', 'csv=p=0'
        ]);

        let output = '';
        ffprobe.stdout.on('data', (data) => {
            output += data.toString();
        });

        ffprobe.stderr.on('data', () => {}); // Ignore stderr

        ffprobe.on('error', (err) => {
            reject(new Error(`FFprobe error: ${err.message}`));
        });

        ffprobe.on('close', (code) => {
            if (code === 0 && output.trim()) {
                const duration = parseFloat(output.trim());
                if (!isNaN(duration) && duration > 0) {
                    resolve(duration);
                } else {
                    reject(new Error('Could not parse media duration'));
                }
            } else {
                reject(new Error('FFprobe failed to get duration'));
            }
        });

        // Write buffer to stdin
        ffprobe.stdin.write(buffer);
        ffprobe.stdin.end();
    });
}

/**
 * Encode media to target format
 * @param {Buffer} inputBuffer - Input media buffer
 * @param {string} mimeType - Input MIME type
 * @param {object} options - Encoding options
 * @param {function} [onProgress] - Progress callback (percent)
 * @returns {Promise<{buffer: Buffer, mimeType: string, size: number}>}
 */
async function encodeMedia(inputBuffer, mimeType, options = {}, onProgress = null) {
    const formatInfo = getFormatInfo(mimeType);
    if (!formatInfo) {
        throw new Error(`Unsupported media format: ${mimeType}`);
    }

    // Check if FFmpeg is available
    const ffmpegAvailable = await isFFmpegAvailable();
    if (!ffmpegAvailable) {
        throw new Error(
            'FFmpeg is not available. Please install FFmpeg or set FFMPEG_PATH environment variable.'
        );
    }

    const isAudio = isAudioFormat(mimeType);
    const outputFormat = formatInfo.outputFormat;
    const outputMimeType = isAudio ? 'audio/mpeg' : 'video/mp4';

    // Get duration for bitrate calculation
    let duration;
    try {
        duration = await getMediaDuration(inputBuffer);
    } catch (err) {
        throw new Error(`Could not determine media duration: ${err.message}`);
    }

    // Calculate target bitrate
    const targetSize = options.targetSize || TARGET_FILE_SIZE;
    const bitrate = calculateBitrate(duration, targetSize, isAudio ? 'audio' : 'video');

    // Build FFmpeg arguments
    const ffmpegArgs = [
        '-i', 'pipe:0',
        '-y' // Overwrite output
    ];

    if (isAudio) {
        // Audio encoding to MP3
        ffmpegArgs.push(
            '-vn', // No video
            '-acodec', 'libmp3lame',
            '-b:a', `${bitrate}k`,
            '-ar', '44100', // Sample rate
            '-ac', '2', // Stereo
            '-f', 'mp3'
        );
    } else {
        // Video encoding to MP4
        // Use h264 for video and aac for audio
        ffmpegArgs.push(
            '-vcodec', 'libx264',
            '-preset', 'medium',
            '-crf', '23',
            '-acodec', 'aac',
            '-b:a', '192k',
            '-movflags', '+faststart', // Enable streaming
            '-f', 'mp4'
        );

        // Add video bitrate limit if calculated bitrate is restrictive
        if (bitrate < 5000) {
            ffmpegArgs.push('-b:v', `${bitrate}k`);
            // Remove CRF when using bitrate
            const crfIndex = ffmpegArgs.indexOf('-crf');
            if (crfIndex > -1) {
                ffmpegArgs.splice(crfIndex, 2);
            }
        }
    }

    ffmpegArgs.push('pipe:1'); // Output to stdout

    return new Promise((resolve, reject) => {
        const ffmpeg = spawn(getFFmpegPath(), ffmpegArgs);
        const chunks = [];

        // Handle progress from stderr
        if (onProgress) {
            let lastProgress = 0;
            ffmpeg.stderr.on('data', (data) => {
                const output = data.toString();
                // Parse time from FFmpeg output
                const timeMatch = output.match(/time=(\d+):(\d+):(\d+\.?\d*)/);
                if (timeMatch) {
                    const hours = parseInt(timeMatch[1]);
                    const minutes = parseInt(timeMatch[2]);
                    const seconds = parseFloat(timeMatch[3]);
                    const currentTime = hours * 3600 + minutes * 60 + seconds;
                    const progress = Math.min(100, Math.floor((currentTime / duration) * 100));
                    if (progress !== lastProgress) {
                        lastProgress = progress;
                        onProgress(progress);
                    }
                }
            });
        }

        ffmpeg.stdout.on('data', (data) => {
            chunks.push(data);
        });

        ffmpeg.on('error', (err) => {
            reject(new Error(`FFmpeg encoding error: ${err.message}`));
        });

        ffmpeg.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`FFmpeg exited with code ${code}`));
                return;
            }

            const outputBuffer = Buffer.concat(chunks);
            const outputSize = outputBuffer.length;

            // Check final size
            if (outputSize > MAX_FILE_SIZE) {
                reject(new Error(
                    `Encoded file (${(outputSize / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (${MAX_FILE_SIZE / 1024 / 1024}MB). ` +
                    `Try a smaller input file or lower quality settings.`
                ));
                return;
            }

            resolve({
                buffer: outputBuffer,
                mimeType: outputMimeType,
                size: outputSize
            });
        });

        // Write input to stdin
        ffmpeg.stdin.write(inputBuffer);
        ffmpeg.stdin.end();
    });
}

/**
 * Encode with size reduction if needed
 * Attempts multiple encoding passes to fit within 100MB limit
 * @param {Buffer} inputBuffer - Input media buffer
 * @param {string} mimeType - Input MIME type
 * @param {function} [onProgress] - Progress callback
 * @returns {Promise<{buffer: Buffer, mimeType: string, size: number}>}
 */
async function encodeWithSizeReduction(inputBuffer, mimeType, onProgress = null) {
    const isAudio = isAudioFormat(mimeType);

    // First attempt with default target size
    let result = await encodeMedia(inputBuffer, mimeType, { targetSize: TARGET_FILE_SIZE }, onProgress);

    // If still too large, try with smaller target
    if (result.size > MAX_FILE_SIZE) {
        const reducedTarget = MAX_FILE_SIZE * 0.85; // More aggressive reduction
        result = await encodeMedia(inputBuffer, mimeType, { targetSize: reducedTarget }, onProgress);
    }

    return result;
}

module.exports = {
    isFFmpegAvailable,
    needsEncoding,
    isAudioFormat,
    isVideoFormat,
    getFormatInfo,
    encodeMedia,
    encodeWithSizeReduction,
    getMediaDuration,
    calculateBitrate,
    AUDIO_FORMATS_TO_ENCODE,
    VIDEO_FORMATS_TO_ENCODE,
    MAX_FILE_SIZE,
    TARGET_FILE_SIZE
};
