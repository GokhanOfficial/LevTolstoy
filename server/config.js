require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  maxFileSize: (process.env.MAX_FILE_SIZE || 50) * 1024 * 1024, // MB to bytes

  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    baseUrl: process.env.GEMINI_BASE_URL || null, // Custom base URL (optional)
    filenameModel: process.env.GEMINI_FILENAME_MODEL,
  },

  googleDrive: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    pdfFolderId: process.env.GOOGLE_DRIVE_PDF_FOLDER_ID,
    mdFolderId: process.env.GOOGLE_DRIVE_MD_FOLDER_ID
  },

  // FFmpeg configuration
  // FFmpeg is an optional external dependency used for media encoding.
  // By default, the application will try to use the `ffmpeg` binary available on the system PATH.
  // If FFmpeg is installed in a custom location, set the FFMPEG_PATH environment variable
  // to the absolute path of the ffmpeg executable (e.g., /usr/local/bin/ffmpeg).
  //
  // Note: Media encoding features (such as audio/video conversions) will only work if FFmpeg
  // is installed and accessible via this configuration.
  ffmpeg: {
    // Path or command name for the ffmpeg executable.
    path: process.env.FFMPEG_PATH || 'ffmpeg',
    // Maximum time allowed for a single encoding job before it is aborted (in milliseconds).
    maxEncodingTimeMs: 5 * 60 * 1000, // 5 min timeout
  }
};
