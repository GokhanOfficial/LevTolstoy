const express = require('express');
const router = express.Router();
const s3Service = require('../services/s3');

// GET /api/download/:key(*) - Download file from S3
router.get('/*', async (req, res) => {
    try {
        const s3Key = req.params[0];

        if (!s3Key) {
            return res.status(400).json({
                error: 'S3 key gerekli',
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
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);

        stream.pipe(res);

    } catch (error) {
        console.error('⚠️ İndirme hatası:', error.message);
        res.status(500).json({
            error: 'Dosya indirilemedi',
            details: error.message
        });
    }
});

module.exports = router;
