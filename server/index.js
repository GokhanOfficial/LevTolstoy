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
const filesRoutes = require('./routes/files');
const { router: v2TasksRouter } = require('./v2/routes/tasks');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.use('/locales', express.static(path.join(__dirname, '../frontend/dist/locales')));

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
app.use('/api/files', filesRoutes);
app.use('/api/v2/tasks', upload.array('files', 20), v2TasksRouter);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback — serve React app for non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
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
app.listen(config.port, () => {
    console.log(`🚀 Doc2MD sunucusu http://localhost:${config.port} adresinde çalışıyor`);

    if (!config.openai.apiKey) {
        console.warn('⚠️  OPENAI_API_KEY tanımlanmamış!');
    }
});
