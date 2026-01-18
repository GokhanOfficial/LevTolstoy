// API Communication Layer

const API_BASE = '/api';

/**
 * Convert multiple files to markdown
 * @param {File[]} files - Array of files to convert
 * @param {string} model - Selected AI model
 * @param {Function} onProgress - Progress callback (0-100)
 * @returns {Promise<{success: boolean, markdown?: string, error?: string}>}
 */
async function convertFiles(files, model, onProgress = () => { }) {
    try {
        onProgress(10);

        const formData = new FormData();

        // Add model selection
        formData.append('model', model);

        // Tüm dosyaları 'files' adıyla ekle
        for (const file of files) {
            formData.append('files', file);
        }

        onProgress(30);

        const response = await fetch(`${API_BASE}/convert`, {
            method: 'POST',
            body: formData
        });

        onProgress(80);

        const data = await response.json();

        onProgress(100);

        if (!response.ok) {
            return {
                success: false,
                error: data.error || window.i18n?.t('errors.serverError') || 'Server error'
            };
        }

        return {
            success: true,
            markdown: data.markdown,
            filename: data.filename,
            stats: data.stats
        };

    } catch (error) {
        return {
            success: false,
            error: error.message || window.i18n?.t('errors.serverError') || 'Server error'
        };
    }
}

/**
 * Convert a single file (backwards compatible)
 * @param {File} file - The file to convert
 * @param {Function} onProgress - Progress callback (0-100)
 */
async function convertFile(file, onProgress = () => { }) {
    return convertFiles([file], 'gemini-3-flash-preview', onProgress);
}

/**
 * Get supported formats from server
 * @returns {Promise<Array>}
 */
async function getSupportedFormats() {
    try {
        const response = await fetch(`${API_BASE}/convert/formats`);
        const data = await response.json();
        return data.formats || [];
    } catch (error) {
        return [];
    }
}

/**
 * Health check
 * @returns {Promise<boolean>}
 */
async function healthCheck() {
    try {
        const response = await fetch(`${API_BASE}/health`);
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Generate PDF from markdown and upload to Google Drive
 * @param {string} markdown - Markdown content
 * @param {string} filename - Output filename
 * @returns {Promise<{success: boolean, downloadLink?: string, viewLink?: string, error?: string}>}
 */
async function generatePdf(markdown, filename = 'document') {
    try {
        const response = await fetch(`${API_BASE}/pdf`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ markdown, filename })
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: data.error || 'PDF generation failed'
            };
        }

        return {
            success: true,
            downloadLink: data.downloadLink,
            viewLink: data.viewLink,
            fileId: data.fileId
        };

    } catch (error) {
        return {
            success: false,
            error: error.message || 'PDF generation failed'
        };
    }
}

// Export
window.api = {
    convertFile,
    convertFiles,
    getSupportedFormats,
    healthCheck,
    generatePdf
};
