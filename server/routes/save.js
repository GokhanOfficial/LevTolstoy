const express = require('express');
const router = express.Router();
const s3Service = require('../services/s3');
const crypto = require('crypto');

// POST /api/save/markdown - Save markdown content to S3 or direct download
router.post('/markdown', async (req, res) => {
    try {
        const { markdown, filename = 'document.md' } = req.body;

        if (!markdown) {
            return res.status(400).json({
                error: 'Markdown içeriği gerekli',
                errorKey: 'errors.noContent'
            });
        }

        // Ensure .md extension
        let saveFilename;
        if (filename && filename.trim()) {
            saveFilename = filename.endsWith('.md') ? filename : `${filename.replace(/\.[^/.]+$/, '')}.md`;
        } else {
            const uuid = crypto.randomUUID();
            saveFilename = `${uuid}.md`;
        }

        // If S3 is configured, upload to S3
        if (s3Service.isConfigured()) {
            const s3Key = `output/${crypto.randomUUID()}/${saveFilename}`;

            const { url } = await s3Service.uploadFile(
                markdown,
                s3Key,
                'text/markdown'
            );

            console.log(`💾 Markdown S3'e kaydedildi: ${saveFilename}`);

            res.json({
                success: true,
                url: url,
                s3Key: s3Key,
                filename: saveFilename,
                storage: 's3'
            });
        } else {
            // No S3, return markdown for direct download
            console.log(`💾 Markdown direkt indiriliyor: ${saveFilename}`);

            res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(saveFilename)}`);
            res.send(markdown);
        }

    } catch (error) {
        console.error('❌ Kaydetme hatası:', error.message);
        res.status(500).json({
            error: error.message,
            errorKey: 'errors.saveFailed'
        });
    }
});

module.exports = router;
