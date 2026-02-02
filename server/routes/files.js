const express = require('express');
const router = express.Router();
const s3Service = require('../services/s3');

// GET /api/files/:key(*) - Proxy file from S3
// All files served through our backend for security and rate limiting
router.get('/*', async (req, res) => {
    try {
        const s3Key = decodeURIComponent(req.params[0]);

        if (!s3Key) {
            return res.status(400).json({
                error: 'Dosya anahtarı gerekli',
                errorKey: 'errors.noKey'
            });
        }

        if (!s3Service.isConfigured()) {
            return res.status(503).json({
                error: 'S3 yapılandırılmamış',
                errorKey: 'errors.s3NotConfigured'
            });
        }

        const { stream, contentType } = await s3Service.downloadFile(s3Key);
        const filename = s3Key.split('/').pop();

        res.setHeader('Content-Type', contentType || 'application/octet-stream');

        // For inline viewing (images, PDFs) vs download (others)
        const inlineTypes = ['image/', 'application/pdf'];
        const isInline = inlineTypes.some(type => contentType?.startsWith(type));

        if (isInline) {
            res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(filename)}`);
        } else {
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
        }

        // Cache for 1 hour (files are immutable with UUID keys)
        res.setHeader('Cache-Control', 'public, max-age=3600');

        stream.pipe(res);

    } catch (error) {
        console.error('⚠️ Dosya indirme hatası:', error.message);

        if (error.name === 'NoSuchKey') {
            return res.status(404).json({
                error: 'Dosya bulunamadı',
                errorKey: 'errors.notFound'
            });
        }

        res.status(500).json({
            error: 'Dosya indirilemedi',
            details: error.message
        });
    }
});

module.exports = router;
