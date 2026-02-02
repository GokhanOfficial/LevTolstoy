const express = require('express');
const router = express.Router();
const fileHandler = require('../services/fileHandler');

// POST /api/convert - Birden fazla dosyayı markdown'a dönüştür
router.post('/', async (req, res) => {
    try {
        // Dosya kontrolü
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                error: 'Dosya yüklenmedi',
                errorKey: 'errors.noFile'
            });
        }

        const files = req.files;
        const model = req.body.model || 'gpt-4o'; // Default model
        const fileNames = files.map(f => f.originalname).join(', ');

        console.log(`📄 Dönüştürülüyor: ${files.length} dosya (${fileNames}) | Model: ${model}`);

        // Tüm dosyaları işle ve birleşik markdown al
        const markdown = await fileHandler.processMultipleFiles(files, model);

        console.log(`✅ Dönüştürme tamamlandı: ${files.length} dosya`);

        // Send response with markdown only
        // Drive upload will happen when user clicks download button
        res.json({
            success: true,
            filename: files.length === 1 ? files[0].originalname : `combined_${files.length}_files`,
            markdown: markdown,
            stats: {
                fileCount: files.length,
                totalSize: files.reduce((sum, f) => sum + f.buffer.length, 0),
                markdownLength: markdown.length
            }
        });

    } catch (error) {
        console.error('❌ Dönüştürme hatası:', error.message);

        res.status(500).json({
            error: error.message,
            errorKey: 'errors.conversionFailed'
        });
    }
});

// GET /api/convert/formats - Desteklenen formatları listele
router.get('/formats', (req, res) => {
    const formats = fileHandler.getSupportedFormats();
    res.json({ formats });
});

module.exports = router;
