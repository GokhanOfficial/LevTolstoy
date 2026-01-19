const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const TOKEN_PATH = path.join(__dirname, '../.google-token.json');

let driveClient = null;

/**
 * Google Drive API client'ını başlatır (OAuth ile)
 */
function initializeDrive() {
    if (driveClient) {
        return driveClient;
    }

    if (!config.googleDrive.clientId || !config.googleDrive.clientSecret) {
        return null;
    }

    let token;

    if (process.env.GOOGLE_TOKEN) {
        try {
            token = JSON.parse(process.env.GOOGLE_TOKEN);
        } catch (e) {
            console.error('GOOGLE_TOKEN environment variable parse error:', e.message);
            return null;
        }
    } else if (fs.existsSync(TOKEN_PATH)) {
        try {
            token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
        } catch (e) {
            console.error('Token file parse error:', e.message);
            return null;
        }
    } else {
        return null;
    }

    try {
        const oauth2Client = new google.auth.OAuth2(
            config.googleDrive.clientId,
            config.googleDrive.clientSecret
        );

        oauth2Client.setCredentials(token);

        // Token refresh handler - only works for file system
        if (!process.env.GOOGLE_TOKEN) {
            oauth2Client.on('tokens', (tokens) => {
                const currentToken = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
                const updatedToken = { ...currentToken, ...tokens };
                fs.writeFileSync(TOKEN_PATH, JSON.stringify(updatedToken, null, 2));
            });
        }

        driveClient = google.drive({ version: 'v3', auth: oauth2Client });
        return driveClient;
    } catch (err) {
        console.error('Google Drive başlatma hatası:', err.message);
        return null;
    }
}

/**
 * Google Drive yapılandırılmış mı kontrol eder
 */
function isConfigured() {
    if (!config.googleDrive.clientId || !config.googleDrive.clientSecret) {
        return false;
    }
    return Boolean(config.googleDrive.clientId && config.googleDrive.clientSecret && (fs.existsSync(TOKEN_PATH) || process.env.GOOGLE_TOKEN));
}

/**
 * Office dosyasını PDF'e dönüştürür
 * @param {Buffer} fileBuffer - Dosya içeriği
 * @param {string} mimeType - Orijinal MIME tipi
 * @param {string} googleMimeType - Google Docs/Slides/Sheets MIME tipi
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function convertToPdf(fileBuffer, mimeType, googleMimeType) {
    const drive = initializeDrive();

    if (!drive) {
        throw new Error(
            'Google Drive API yapılandırılmamış. ' +
            '"npm run auth" komutu ile giriş yapın.'
        );
    }

    // 1. Dosyayı Drive'a yükle
    const uploadResponse = await drive.files.create({
        requestBody: {
            name: `temp_conversion_${Date.now()}`,
            mimeType: googleMimeType
        },
        media: {
            mimeType: mimeType,
            body: require('stream').Readable.from(fileBuffer)
        },
        fields: 'id'
    });

    const fileId = uploadResponse.data.id;

    try {
        // 2. PDF olarak export et
        const exportResponse = await drive.files.export({
            fileId: fileId,
            mimeType: 'application/pdf'
        }, {
            responseType: 'arraybuffer'
        });

        return Buffer.from(exportResponse.data);
    } finally {
        // 3. Temp dosyayı sil
        try {
            await drive.files.delete({ fileId });
        } catch (deleteError) {
            console.warn('Temp dosya silinemedi:', deleteError.message);
        }
    }
}

/**
 * Upload file to Google Drive
 * @param {Buffer|string} content - File content (Buffer or string)
 * @param {string} filename - File name
 * @param {string} mimeType - MIME type
 * @param {string} [folderId] - Optional folder ID
 * @returns {Promise<{fileId: string, webViewLink: string}>}
 */
async function uploadFile(content, filename, mimeType, folderId) {
    const drive = initializeDrive();

    if (!drive) {
        throw new Error('Google Drive yapılandırılmamış');
    }

    // Create file metadata
    const fileMetadata = {
        name: filename,
        mimeType: mimeType
    };

    // Add to folder if specified
    if (folderId) {
        fileMetadata.parents = [folderId];
    }

    // Create readable stream
    const { PassThrough } = require('stream');
    const bufferStream = new PassThrough();

    if (Buffer.isBuffer(content)) {
        bufferStream.end(content);
    } else {
        bufferStream.end(Buffer.from(content));
    }

    // Upload file
    const response = await drive.files.create({
        requestBody: fileMetadata,
        media: {
            mimeType: mimeType,
            body: bufferStream
        },
        fields: 'id,webViewLink'
    });

    return {
        fileId: response.data.id,
        webViewLink: response.data.webViewLink
    };
}

/**
 * Download file from Google Drive by fileId
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<{stream: ReadableStream, filename: string, mimeType: string}>}
 */
async function downloadFromDrive(fileId) {
    const drive = initializeDrive();

    if (!drive) {
        throw new Error('Google Drive yapılandırılmamış');
    }

    // Get file metadata
    const fileInfo = await drive.files.get({
        fileId: fileId,
        fields: 'name,mimeType'
    });

    // Get file content
    const response = await drive.files.get({
        fileId: fileId,
        alt: 'media'
    }, { responseType: 'stream' });

    return {
        stream: response.data,
        filename: fileInfo.data.name,
        mimeType: fileInfo.data.mimeType
    };
}

module.exports = {
    isConfigured,
    convertToPdf,
    initializeDrive,
    uploadFile,
    downloadFromDrive
};
