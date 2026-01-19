const express = require('express');
const router = express.Router();
const googleDriveService = require('../services/googleDrive');

// GET /api/download/:fileId - Drive'dan dosya indir
router.get('/:fileId', async (req, res) => {
    try {
        const fileId = req.params.fileId;

        if (!googleDriveService.isConfigured()) {
            return res.status(503).json({
                error: 'Google Drive yapılandırılmamış',
                errorKey: 'errors.driveNotConfigured'
            });
        }

        const { stream, filename, mimeType } = await googleDriveService.downloadFromDrive(fileId);

        res.setHeader('Content-Type', mimeType);
        // Use RFC 5987 format for proper Unicode filename support
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
