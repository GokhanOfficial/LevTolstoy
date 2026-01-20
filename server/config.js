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
  }
};
