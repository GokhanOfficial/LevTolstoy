const express = require('express');
const router = express.Router();
const geminiService = require('../services/gemini');

// POST /api/generate-title - Generate a title from markdown content
router.post('/', async (req, res) => {
    try {
        const { markdown, model } = req.body;

        if (!markdown) {
            return res.status(400).json({
                error: 'Markdown içeriği gerekli',
                errorKey: 'errors.noContent'
            });
        }

        console.log('🏷️ Başlık üretiliyor...');

        const title = await geminiService.generateFilename(markdown, model);

        res.json({
            success: true,
            title: title
        });

    } catch (error) {
        console.error('❌ Başlık üretme hatası:', error.message);

        // Fallback to UUID
        const crypto = require('crypto');
        const fallbackTitle = crypto.randomUUID();

        res.json({
            success: true,
            title: fallbackTitle,
            fallback: true
        });
    }
});

module.exports = router;
