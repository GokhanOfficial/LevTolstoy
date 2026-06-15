const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('../config');

const MB = 1024 * 1024;
const MAX_FILE_SIZE = config.media.maxOutputSizeMb * MB;
const TARGET_FILE_SIZE = config.media.targetOutputSizeMb * MB;
const MIN_AUDIO_BITRATE_KBPS = config.media.minAudioBitrateKbps;
const MAX_AUDIO_BITRATE_KBPS = config.media.maxAudioBitrateKbps;
const OUTPUT_SAMPLE_RATE = config.media.outputSampleRate;

const AUDIO_FORMATS_TO_ENCODE = {
    'audio/mp4': { ext: '.m4a', name: 'M4A', outputFormat: 'mp3' },
    'audio/aac': { ext: '.aac', name: 'AAC', outputFormat: 'mp3' },
    'audio/aacp': { ext: '.aac', name: 'AAC+', outputFormat: 'mp3' },
    'audio/opus': { ext: '.opus', name: 'Opus', outputFormat: 'mp3' },
    'audio/flac': { ext: '.flac', name: 'FLAC', outputFormat: 'mp3' },
    'audio/oga': { ext: '.oga', name: 'OGA', outputFormat: 'mp3' },
    'audio/x-flac': { ext: '.flac', name: 'FLAC', outputFormat: 'mp3' },
    'audio/x-aac': { ext: '.aac', name: 'AAC', outputFormat: 'mp3' },
    'audio/x-m4a': { ext: '.m4a', name: 'M4A', outputFormat: 'mp3' },
    'audio/x-opus': { ext: '.opus', name: 'Opus', outputFormat: 'mp3' },
    'audio/webm': { ext: '.weba', name: 'WebM Audio', outputFormat: 'mp3' }
};

const VIDEO_FORMATS_TO_ENCODE = {
    'video/mp4': { ext: '.mp4', name: 'MP4', outputFormat: 'mp3' },
    'video/x-matroska': { ext: '.mkv', name: 'MKV', outputFormat: 'mp3' },
    'video/3gpp': { ext: '.3gp', name: '3GP', outputFormat: 'mp3' },
    'video/webm': { ext: '.webm', name: 'WebM', outputFormat: 'mp3' },
    'video/x-m4v': { ext: '.m4v', name: 'M4V', outputFormat: 'mp3' },
    'video/avi': { ext: '.avi', name: 'AVI', outputFormat: 'mp3' },
    'video/x-msvideo': { ext: '.avi', name: 'AVI', outputFormat: 'mp3' },
    'video/quicktime': { ext: '.mov', name: 'MOV', outputFormat: 'mp3' },
    'video/x-ms-wmv': { ext: '.wmv', name: 'WMV', outputFormat: 'mp3' },
    'video/x-flv': { ext: '.flv', name: 'FLV', outputFormat: 'mp3' },
    'video/mpeg': { ext: '.mpeg', name: 'MPEG', outputFormat: 'mp3' }
};

const ALL_FORMATS_TO_ENCODE = {
    ...AUDIO_FORMATS_TO_ENCODE,
    ...VIDEO_FORMATS_TO_ENCODE
};

function getFFmpegPath() {
    return config.media.ffmpegPath;
}

function getFFprobePath() {
    return config.media.ffprobePath;
}

async function commandAvailable(command, args) {
    return new Promise((resolve) => {
        const child = spawn(command, args, { stdio: 'ignore' });
        child.on('error', () => resolve(false));
        child.on('close', (code) => resolve(code === 0));
    });
}

async function isFFmpegAvailable() {
    return commandAvailable(getFFmpegPath(), ['-version']);
}

async function isFFprobeAvailable() {
    return commandAvailable(getFFprobePath(), ['-version']);
}

function needsEncoding(mimeType) {
    return mimeType in ALL_FORMATS_TO_ENCODE;
}

function isAudioFormat(mimeType) {
    return mimeType in AUDIO_FORMATS_TO_ENCODE;
}

function isVideoFormat(mimeType) {
    return mimeType in VIDEO_FORMATS_TO_ENCODE;
}

function isMp3Mime(mimeType) {
    return mimeType === 'audio/mpeg' || mimeType === 'audio/mp3';
}

function getFormatInfo(mimeType) {
    return ALL_FORMATS_TO_ENCODE[mimeType] || null;
}

function calculateBitrate(durationSeconds, targetSizeBytes = TARGET_FILE_SIZE) {
    if (!durationSeconds || durationSeconds <= 0) {
        throw new Error('Media duration must be greater than zero');
    }

    const overheadSafeSize = targetSizeBytes * 0.94;
    const bitrateKbps = Math.floor((overheadSafeSize * 8) / durationSeconds / 1000);
    return Math.min(Math.max(bitrateKbps, MIN_AUDIO_BITRATE_KBPS), MAX_AUDIO_BITRATE_KBPS);
}

function estimateSizeBytes(durationSeconds, bitrateKbps) {
    return Math.ceil((durationSeconds * bitrateKbps * 1000) / 8);
}

function ensureFitsAtMinimumBitrate(durationSeconds) {
    const estimated = estimateSizeBytes(durationSeconds, MIN_AUDIO_BITRATE_KBPS);
    if (estimated > TARGET_FILE_SIZE) {
        throw new Error(
            `Medya dosyası 32kbps minimum bitrate ile bile 100MB altına indirilemiyor. ` +
            `Süre: ${Math.round(durationSeconds)} sn, tahmini çıktı: ${(estimated / MB).toFixed(1)}MB.`
        );
    }
}

function parseFfprobeJson(output) {
    try {
        const parsed = JSON.parse(output);
        const duration = Number(parsed.format?.duration);
        const hasAudio = Array.isArray(parsed.streams) && parsed.streams.some(stream => stream.codec_type === 'audio');
        return { duration, hasAudio };
    } catch {
        return { duration: NaN, hasAudio: false };
    }
}

function getMediaInfo(inputPath) {
    return new Promise((resolve, reject) => {
        const ffprobe = spawn(getFFprobePath(), [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            inputPath
        ]);

        let output = '';
        let stderr = '';

        ffprobe.stdout.on('data', data => { output += data.toString(); });
        ffprobe.stderr.on('data', data => { stderr += data.toString(); });
        ffprobe.on('error', err => reject(new Error(`FFprobe error: ${err.message}`)));
        ffprobe.on('close', code => {
            if (code !== 0) {
                reject(new Error(`FFprobe exited with code ${code}: ${stderr}`));
                return;
            }

            const info = parseFfprobeJson(output);
            if (!info.hasAudio) {
                reject(new Error('Bu medya dosyasında işlenebilir ses akışı bulunamadı.'));
                return;
            }
            if (!Number.isFinite(info.duration) || info.duration <= 0) {
                reject(new Error('Medya süresi okunamadı.'));
                return;
            }
            resolve(info);
        });
    });
}

function getMediaDuration(input) {
    if (Buffer.isBuffer(input)) {
        return withTempDir(async (dir) => {
            const inputPath = path.join(dir, 'input.media');
            await fs.promises.writeFile(inputPath, input);
            const info = await getMediaInfo(inputPath);
            return info.duration;
        });
    }
    return getMediaInfo(input).then(info => info.duration);
}

async function withTempDir(fn) {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'levtolstoy-media-'));
    try {
        return await fn(tempDir);
    } finally {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
}

function killProcess(child) {
    if (!child || child.killed) return;

    try {
        if (child.pid) {
            process.kill(-child.pid, 'SIGTERM');
        } else {
            child.kill('SIGTERM');
        }
    } catch {
        try { child.kill('SIGTERM'); } catch { }
    }

    setTimeout(() => {
        if (!child.killed) {
            try {
                if (child.pid) process.kill(-child.pid, 'SIGKILL');
                else child.kill('SIGKILL');
            } catch { }
        }
    }, 5000).unref();
}

function runFfmpeg(inputPath, outputPath, duration, bitrateKbps, options = {}) {
    const { onProgress = null, signal = null, registerProcess = null } = options;
    const args = [
        '-hide_banner',
        '-y',
        '-i', inputPath,
        '-vn',
        '-map', '0:a:0',
        '-codec:a', 'libmp3lame',
        '-b:a', `${bitrateKbps}k`,
        '-ar', String(OUTPUT_SAMPLE_RATE),
        '-ac', bitrateKbps <= 48 ? '1' : '2',
        '-f', 'mp3',
        '-progress', 'pipe:2',
        '-nostats',
        outputPath
    ];

    return new Promise((resolve, reject) => {
        const ffmpeg = spawn(getFFmpegPath(), args, { detached: true, stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        let settled = false;

        if (registerProcess) registerProcess(ffmpeg);

        const abortHandler = () => {
            if (settled) return;
            settled = true;
            killProcess(ffmpeg);
            reject(new Error('Dönüştürme işlemi iptal edildi.'));
        };

        if (signal?.aborted) {
            abortHandler();
            return;
        }
        signal?.addEventListener('abort', abortHandler, { once: true });

        ffmpeg.stderr.on('data', (data) => {
            const text = data.toString();
            stderr += text;

            if (onProgress) {
                const match = text.match(/out_time_ms=(\d+)/);
                if (match) {
                    const currentSeconds = Number(match[1]) / 1000000;
                    const percent = Math.min(100, Math.max(0, Math.round((currentSeconds / duration) * 100)));
                    onProgress({ percent, bitrateKbps });
                }
            }
        });

        ffmpeg.on('error', (err) => {
            if (settled) return;
            settled = true;
            signal?.removeEventListener('abort', abortHandler);
            reject(new Error(`FFmpeg encoding error: ${err.message}`));
        });

        ffmpeg.on('close', (code) => {
            if (settled) return;
            settled = true;
            signal?.removeEventListener('abort', abortHandler);
            if (code !== 0) {
                reject(new Error(`FFmpeg exited with code ${code}: ${stderr.split('\n').slice(-8).join(' ')}`));
                return;
            }
            if (onProgress) onProgress({ percent: 100, bitrateKbps });
            resolve();
        });
    });
}

async function ensureToolsAvailable() {
    const [ffmpegAvailable, ffprobeAvailable] = await Promise.all([
        isFFmpegAvailable(),
        isFFprobeAvailable()
    ]);

    if (!ffmpegAvailable) {
        throw new Error('FFmpeg bulunamadı. FFmpeg yükleyin veya FFMPEG_PATH ortam değişkenini ayarlayın.');
    }
    if (!ffprobeAvailable) {
        throw new Error('FFprobe bulunamadı. FFmpeg paketinin ffprobe aracını yükleyin veya FFPROBE_PATH ortam değişkenini ayarlayın.');
    }
}

async function encodePathToMp3(inputPath, inputMimeType, options = {}) {
    await ensureToolsAvailable();

    const inputStat = await fs.promises.stat(inputPath);
    if (isMp3Mime(inputMimeType) && inputStat.size <= MAX_FILE_SIZE) {
        return {
            filePath: inputPath,
            mimeType: 'audio/mpeg',
            size: inputStat.size,
            duration: null,
            bitrateKbps: null,
            converted: false
        };
    }

    const mediaInfo = await getMediaInfo(inputPath);
    ensureFitsAtMinimumBitrate(mediaInfo.duration);

    const targetSize = options.targetSize || TARGET_FILE_SIZE;
    let bitrate = calculateBitrate(mediaInfo.duration, targetSize);
    let lastOutputPath = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
        const outputPath = path.join(options.tempDir || path.dirname(inputPath), `encoded-${Date.now()}-${attempt}.mp3`);
        await runFfmpeg(inputPath, outputPath, mediaInfo.duration, bitrate, {
            onProgress: (progress) => options.onProgress?.({
                ...progress,
                attempt,
                duration: mediaInfo.duration,
                stage: 'media-encoding'
            }),
            signal: options.signal,
            registerProcess: options.registerProcess
        });

        const stat = await fs.promises.stat(outputPath);
        if (lastOutputPath && lastOutputPath !== outputPath) {
            await fs.promises.rm(lastOutputPath, { force: true });
        }
        lastOutputPath = outputPath;

        if (stat.size <= MAX_FILE_SIZE) {
            return {
                filePath: outputPath,
                mimeType: 'audio/mpeg',
                size: stat.size,
                duration: mediaInfo.duration,
                bitrateKbps: bitrate,
                converted: true
            };
        }

        const ratio = TARGET_FILE_SIZE / stat.size;
        bitrate = Math.max(MIN_AUDIO_BITRATE_KBPS, Math.floor(bitrate * ratio * 0.96));
        if (bitrate <= MIN_AUDIO_BITRATE_KBPS && stat.size > MAX_FILE_SIZE) {
            throw new Error(`MP3 çıktısı 32kbps minimum bitrate ile 100MB altına indirilemedi (${(stat.size / MB).toFixed(1)}MB).`);
        }
    }

    throw new Error('MP3 çıktısı 100MB altına indirilemedi.');
}

async function encodeMedia(inputBuffer, mimeType, options = {}, onProgress = null) {
    if (typeof options === 'function') {
        onProgress = options;
        options = {};
    }
    return withTempDir(async (dir) => {
        const inputPath = path.join(dir, `input${getFormatInfo(mimeType)?.ext || '.media'}`);
        await fs.promises.writeFile(inputPath, inputBuffer);
        const result = await encodePathToMp3(inputPath, mimeType, { ...options, tempDir: dir, onProgress });
        const buffer = await fs.promises.readFile(result.filePath);
        return {
            buffer,
            mimeType: result.mimeType,
            size: result.size,
            duration: result.duration,
            bitrateKbps: result.bitrateKbps,
            converted: result.converted
        };
    });
}

async function encodeWithSizeReduction(inputBuffer, mimeType, onProgress = null) {
    return encodeMedia(inputBuffer, mimeType, { targetSize: TARGET_FILE_SIZE }, onProgress);
}

module.exports = {
    isFFmpegAvailable,
    isFFprobeAvailable,
    needsEncoding,
    isAudioFormat,
    isVideoFormat,
    isMp3Mime,
    getFormatInfo,
    encodeMedia,
    encodeWithSizeReduction,
    encodePathToMp3,
    getMediaDuration,
    getMediaInfo,
    calculateBitrate,
    killProcess,
    AUDIO_FORMATS_TO_ENCODE,
    VIDEO_FORMATS_TO_ENCODE,
    MAX_FILE_SIZE,
    TARGET_FILE_SIZE,
    MIN_AUDIO_BITRATE_KBPS,
    MAX_AUDIO_BITRATE_KBPS
};
