const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const config = require('./config');
const convertRoutes = require('./routes/convert');
const pdfRoutes = require('./routes/pdf');
const downloadRoutes = require('./routes/download');
const saveRoutes = require('./routes/save');
const generateTitleRoutes = require('./routes/generate-title');
const uploadRoutes = require('./routes/upload');
const tasksRoutes = require('./routes/tasks');
const summarizeRoutes = require('./routes/summarize');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// File upload configuration
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: config.maxFileSize }
});

// Routes - support multiple files (up to 10)
app.use('/api/convert', upload.array('files', 10), convertRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api/save', saveRoutes);
app.use('/api/generate-title', generateTitleRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/convert', tasksRoutes);
app.use('/api/summarize', summarizeRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve MD to PDF editor page
app.get('/md-to-pdf', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/md-to-pdf.html'));
});

// Serve Summarizer page
app.get('/summarizer', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/summarizer.html'));
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err.message);

    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: `Dosya boyutu çok büyük. Maksimum: ${config.maxFileSize / 1024 / 1024}MB`
            });
        }
    }

    res.status(500).json({ error: err.message || 'Sunucu hatası' });
});

// Start server
app.listen(config.port, async () => {
    console.log(`🚀 Doc2MD sunucusu http://localhost:${config.port} adresinde çalışıyor`);

    if (!config.gemini.apiKey) {
        console.warn('⚠️  GEMINI_API_KEY tanımlanmamış!');
    }

    // Check FFmpeg availability
    const mediaEncoder = require('./services/mediaEncoder');
    await mediaEncoder.checkFfmpeg();
});
