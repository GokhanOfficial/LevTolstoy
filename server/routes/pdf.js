const express = require('express');
const router = express.Router();
const pdfService = require('../services/pdfService');
const s3Service = require('../services/s3');
const crypto = require('crypto');

// POST /api/pdf - Generate PDF from markdown
router.post('/', async (req, res) => {
    try {
        const { markdown, filename = 'document' } = req.body;

        if (!markdown) {
            return res.status(400).json({
                error: 'Markdown içeriği gerekli',
                errorKey: 'errors.noContent'
            });
        }

        console.log(`📄 PDF oluşturuluyor: ${filename}`);

        // Generate PDF
        const pdfBuffer = await pdfService.generatePdf(markdown);

        // Ensure .pdf extension
        const pdfFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

        // If S3 is configured, upload to S3
        if (s3Service.isConfigured()) {
            const s3Key = `output/${crypto.randomUUID()}/${pdfFilename}`;

            const { url } = await s3Service.uploadFile(
                pdfBuffer,
                s3Key,
                'application/pdf'
            );

            console.log(`✅ PDF S3'e yüklendi: ${pdfFilename}`);

            res.json({
                success: true,
                url: url,
                s3Key: s3Key,
                filename: pdfFilename,
                storage: 's3'
            });
        } else {
            // No S3, return PDF for direct download
            console.log(`✅ PDF direkt indiriliyor: ${pdfFilename}`);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(pdfFilename)}`);
            res.send(pdfBuffer);
        }

    } catch (error) {
        console.error('❌ PDF hatası:', error.message);

        res.status(500).json({
            error: error.message,
            errorKey: 'errors.pdfFailed'
        });
    }
});

// GET /api/pdf/download/:key(*) - Download PDF from S3 (proxy)
router.get('/download/*', async (req, res) => {
    try {
        const s3Key = req.params[0];

        if (!s3Key) {
            return res.status(400).send('S3 key required');
        }

        if (!s3Service.isConfigured()) {
            return res.status(503).json({
                error: 'S3 yapılandırılmamış',
                errorKey: 'errors.s3NotConfigured'
            });
        }

        const { stream, contentType } = await s3Service.downloadFile(s3Key);
        const filename = s3Key.split('/').pop();

        res.setHeader('Content-Type', contentType || 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);

        stream.pipe(res);

    } catch (error) {
        console.error('Download error:', error.message);
        res.status(500).send('Download failed');
    }
});

module.exports = router;
