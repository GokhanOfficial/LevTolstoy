const express = require('express');
const router = express.Router();
const googleDriveService = require('../services/googleDrive');
const config = require('../config');
const crypto = require('crypto');

// POST /api/save/markdown - Save markdown content to Drive
router.post('/markdown', async (req, res) => {
    try {
        const { markdown, filename = 'document.md' } = req.body;

        if (!markdown) {
            return res.status(400).json({
                error: 'Markdown içeriği gerekli',
                errorKey: 'errors.noContent'
            });
        }

        if (!googleDriveService.isConfigured()) {
            return res.status(503).json({
                error: 'Google Drive yapılandırılmamış',
                errorKey: 'errors.driveNotConfigured'
            });
        }

        // Use provided filename, fallback to UUID if not provided
        let driveFilename;
        if (filename && filename.trim()) {
            // Ensure .md extension
            driveFilename = filename.endsWith('.md') ? filename : `${filename.replace(/\.[^/.]+$/, '')}.md`;
        } else {
            // Fallback to UUID
            const uuid = crypto.randomUUID();
            driveFilename = `${uuid}.md`;
        }

        // Upload to Markdown folder if configured
        const folderId = config.googleDrive.mdFolderId;

        console.log(`💾 Markdown kaydediliyor (Drive): ${driveFilename}`);

        const result = await googleDriveService.uploadFile(
            markdown,
            driveFilename,
            'text/markdown',
            folderId
        );

        res.json({
            success: true,
            fileId: result.fileId,
            webViewLink: result.webViewLink
        });

    } catch (error) {
        console.error('❌ Kaydetme hatası:', error.message);
        res.status(500).json({
            error: error.message,
            errorKey: 'errors.saveFailed'
        });
    }
});

module.exports = router;
