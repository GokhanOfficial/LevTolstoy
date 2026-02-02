const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const config = require('../config');
const crypto = require('crypto');

let s3Client = null;

/**
 * Initialize S3 client
 */
function initializeS3() {
    if (s3Client) {
        return s3Client;
    }

    if (!isConfigured()) {
        return null;
    }

    s3Client = new S3Client({
        endpoint: config.s3.endpoint,
        region: config.s3.region || 'auto',
        credentials: {
            accessKeyId: config.s3.accessKeyId,
            secretAccessKey: config.s3.secretAccessKey
        },
        forcePathStyle: true // Required for R2 and some S3-compatible services
    });

    return s3Client;
}

/**
 * Check if S3 is configured
 */
function isConfigured() {
    return Boolean(
        config.s3.endpoint &&
        config.s3.accessKeyId &&
        config.s3.secretAccessKey &&
        config.s3.bucket
    );
}

/**
 * Generate a unique key for file storage
 * @param {string} prefix - Prefix for the key (e.g., 'uploads', 'output')
 * @param {string} extension - File extension (e.g., '.pdf', '.md')
 * @returns {string} - Unique key
 */
function generateKey(prefix, extension) {
    const uuid = crypto.randomUUID();
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return `${prefix}/${date}/${uuid}${extension}`;
}

/**
 * Get proxy URL for a key (serves through our backend)
 * @param {string} key - S3 object key
 * @returns {string} - Proxy URL through our backend
 */
function getProxyUrl(key) {
    // All files served through our backend for security and rate limiting
    return `/api/files/${encodeURIComponent(key)}`;
}

/**
 * Upload a file to S3
 * @param {Buffer|string} content - File content
 * @param {string} key - S3 object key
 * @param {string} contentType - MIME type
 * @returns {Promise<{key: string, url: string}>}
 */
async function uploadFile(content, key, contentType) {
    const client = initializeS3();

    if (!client) {
        throw new Error('S3 yapılandırılmamış');
    }

    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);

    const command = new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType
    });

    await client.send(command);

    // Return proxy URL (through our backend)
    const url = getProxyUrl(key);

    console.log(`☁️ S3'e yüklendi: ${key}`);

    return { key, url };
}

/**
 * Upload file with auto-generated key
 * @param {Buffer|string} content - File content
 * @param {string} prefix - Key prefix (e.g., 'uploads', 'output')
 * @param {string} extension - File extension
 * @param {string} contentType - MIME type
 * @returns {Promise<{key: string, url: string}>}
 */
async function uploadWithAutoKey(content, prefix, extension, contentType) {
    const key = generateKey(prefix, extension);
    return uploadFile(content, key, contentType);
}

/**
 * Download file from S3
 * @param {string} key - S3 object key
 * @returns {Promise<{stream: ReadableStream, contentType: string}>}
 */
async function downloadFile(key) {
    const client = initializeS3();

    if (!client) {
        throw new Error('S3 yapılandırılmamış');
    }

    const command = new GetObjectCommand({
        Bucket: config.s3.bucket,
        Key: key
    });

    const response = await client.send(command);

    return {
        stream: response.Body,
        contentType: response.ContentType
    };
}

/**
 * Delete file from S3
 * @param {string} key - S3 object key
 */
async function deleteFile(key) {
    const client = initializeS3();

    if (!client) {
        throw new Error('S3 yapılandırılmamış');
    }

    const command = new DeleteObjectCommand({
        Bucket: config.s3.bucket,
        Key: key
    });

    await client.send(command);
    console.log(`🗑️ S3'ten silindi: ${key}`);
}

/**
 * Extract key from proxy URL
 * @param {string} url - Proxy URL (/api/files/key)
 * @returns {string|null} - S3 key or null
 */
function extractKeyFromUrl(url) {
    if (!url) return null;

    const prefix = '/api/files/';
    if (url.startsWith(prefix)) {
        return decodeURIComponent(url.slice(prefix.length));
    }

    return null;
}

module.exports = {
    isConfigured,
    uploadFile,
    uploadWithAutoKey,
    downloadFile,
    deleteFile,
    getProxyUrl,
    generateKey,
    extractKeyFromUrl
};
