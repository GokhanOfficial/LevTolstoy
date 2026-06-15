require('dotenv').config();

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  maxFileSize: toNumber(process.env.MAX_FILE_SIZE, 1024) * 1024 * 1024, // MB to bytes

  media: {
    ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
    ffprobePath: process.env.FFPROBE_PATH || 'ffprobe',
    maxUploadSizeMb: toNumber(process.env.MAX_UPLOAD_SIZE_MB || process.env.MAX_FILE_SIZE, 1024),
    maxOutputSizeMb: toNumber(process.env.MEDIA_MAX_OUTPUT_SIZE_MB, 100),
    targetOutputSizeMb: toNumber(process.env.MEDIA_TARGET_OUTPUT_SIZE_MB, 95),
    minAudioBitrateKbps: toNumber(process.env.MEDIA_MIN_AUDIO_BITRATE_KBPS, 32),
    maxAudioBitrateKbps: toNumber(process.env.MEDIA_MAX_AUDIO_BITRATE_KBPS, 320),
    outputSampleRate: toNumber(process.env.MEDIA_OUTPUT_SAMPLE_RATE, 44100),
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_BASE_URL || null,
    filenameModel: process.env.OPENAI_FILENAME_MODEL,
  },

  // S3-compatible storage (Cloudflare R2, AWS S3, MinIO, etc.)
  // All files are served through our backend (proxy) for security
  s3: {
    endpoint: process.env.S3_ENDPOINT,           // https://xxx.r2.cloudflarestorage.com
    region: process.env.S3_REGION || 'auto',     // 'auto' for R2, region for AWS
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    bucket: process.env.S3_BUCKET
  },

  // Google Drive API (OAuth - only for DOCX/PPTX/XLSX → PDF conversion)
  googleDrive: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }
};
