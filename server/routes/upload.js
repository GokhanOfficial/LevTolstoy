const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Cache directory
const CACHE_DIR = path.join(__dirname, '../../public/cache');
const CACHE_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Track cached files for cleanup
const cachedFiles = new Map(); // fileId -> { path, expireTimeout }

// Multer configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, CACHE_DIR);
    },
    filename: (req, file, cb) => {
        const fileId = crypto.randomUUID();
        const ext = path.extname(file.originalname);
        cb(null, `${fileId}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: MAX_FILE_SIZE
    },
    fileFilter: (req, file, cb) => {
        // Accept common document types
        const allowedTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'audio/mpeg',
            'audio/wav',
            'audio/ogg',
            'video/mp4',
            'video/webm',
            'text/plain',
            'text/markdown'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Desteklenmeyen dosya türü: ${file.mimetype}`), false);
        }
    }
});

/**
 * Schedule file deletion after expiry
 */
function scheduleFileDeletion(fileId, filePath) {
    const timeout = setTimeout(() => {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`🗑️ Cache temizlendi: ${path.basename(filePath)}`);
            }
        } catch (e) {
            console.error('Cache temizleme hatası:', e.message);
        }
        cachedFiles.delete(fileId);
    }, CACHE_EXPIRY_MS);

    cachedFiles.set(fileId, { path: filePath, expireTimeout: timeout });
}

/**
 * POST /api/upload - Upload file to cache
 */
router.post('/', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'Dosya yüklenmedi',
                errorKey: 'errors.noFile'
            });
        }

        const fileId = path.basename(req.file.filename, path.extname(req.file.filename));
        const filePath = req.file.path;
        const url = `/cache/${req.file.filename}`;

        // Schedule cleanup
        scheduleFileDeletion(fileId, filePath);

        console.log(`📤 Dosya cache'e yüklendi: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);

        res.json({
            success: true,
            fileId,
            url,
            filename: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
            expiresIn: CACHE_EXPIRY_MS
        });

    } catch (error) {
        console.error('Upload hatası:', error.message);
        res.status(500).json({
            error: error.message,
            errorKey: 'errors.uploadFailed'
        });
    }
});

/**
 * DELETE /api/upload/:fileId - Manually delete cached file
 */
router.delete('/:fileId', (req, res) => {
    const { fileId } = req.params;
    const cached = cachedFiles.get(fileId);

    if (cached) {
        clearTimeout(cached.expireTimeout);
        try {
            if (fs.existsSync(cached.path)) {
                fs.unlinkSync(cached.path);
            }
        } catch (e) {
            // Ignore
        }
        cachedFiles.delete(fileId);
    }

    res.json({ success: true });
});

// Error handler for multer
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
                error: 'Dosya boyutu 100 MB limitini aşıyor',
                errorKey: 'errors.fileTooLarge'
            });
        }
    }
    res.status(400).json({
        error: err.message,
        errorKey: 'errors.uploadFailed'
    });
});

module.exports = router;
