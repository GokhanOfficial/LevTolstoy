const express = require('express');
const router = express.Router();
const pdfService = require('../services/pdfService');
const googleDriveService = require('../services/googleDrive'); // Import googleDriveService

// POST /api/pdf - Generate PDF from markdown and upload to Drive
router.post('/', async (req, res) => {
    try {
        const { markdown, filename = 'document' } = req.body;

        if (!markdown) {
            return res.status(400).json({
                error: 'Markdown içeriği gerekli',
                errorKey: 'errors.noContent'
            });
        }

        if (!googleDriveService.isConfigured()) { // Use googleDriveService for checks too
            return res.status(400).json({
                error: 'Google Drive yapılandırılmamış. "npm run auth" ile giriş yapın.',
                errorKey: 'errors.driveNotConfigured'
            });
        }

        console.log(`📄 PDF oluşturuluyor: ${filename}`);

        // Generate PDF
        const pdfBuffer = await pdfService.generatePdf(markdown);

        console.log(`📤 Google Drive\'a yükleniyor...`);

        // Upload to Drive
        const driveResult = await pdfService.uploadToDrive(pdfBuffer, filename);

        console.log(`✅ PDF yüklendi: ${driveResult.fileId}`);

        res.json({
            success: true,
            fileId: driveResult.fileId,
            // viewLink feature removed since files are private
            downloadLink: `/api/pdf/download/${driveResult.fileId}`
        });

    } catch (error) {
        console.error('❌ PDF hatası:', error.message);

        res.status(500).json({
            error: error.message,
            errorKey: 'errors.pdfFailed'
        });
    }
});

// GET /api/pdf/download/:fileId - Proxy download from Drive
router.get('/download/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;

        if (!fileId) {
            return res.status(400).send('File ID required');
        }

        const { stream, filename, mimeType } = await googleDriveService.downloadFromDrive(fileId); // Use googleDriveService

        res.setHeader('Content-Type', mimeType);
        // Use RFC 5987 format for proper Unicode filename support
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);

        stream.pipe(res);

    } catch (error) {
        console.error('Download error:', error.message);
        res.status(500).send('Download failed');
    }
});

module.exports = router;
