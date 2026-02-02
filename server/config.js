require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  maxFileSize: (process.env.MAX_FILE_SIZE || 50) * 1024 * 1024, // MB to bytes

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_BASE_URL || null, // Custom base URL (optional)
    filenameModel: process.env.OPENAI_FILENAME_MODEL,
  },

  googleDrive: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    pdfFolderId: process.env.GOOGLE_DRIVE_PDF_FOLDER_ID,
    mdFolderId: process.env.GOOGLE_DRIVE_MD_FOLDER_ID
  }
};
