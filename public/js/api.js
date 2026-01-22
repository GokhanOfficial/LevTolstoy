// API Communication Layer

const API_BASE = '/api';

/**
 * Upload a file to cache
 * @param {File} file - File to upload
 * @param {Function} onProgress - Progress callback (0-100)
 * @returns {Promise<{success: boolean, fileId?: string, url?: string, error?: string}>}
 */
async function uploadToCache(file, onProgress = () => { }) {
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', file);

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                onProgress(percent);
            }
        });

        xhr.addEventListener('load', () => {
            try {
                const data = JSON.parse(xhr.responseText);
                if (xhr.status === 200 && data.success) {
                    resolve({
                        success: true,
                        fileId: data.fileId,
                        url: data.url,
                        filename: data.filename,
                        mimetype: data.mimetype,
                        size: data.size
                    });
                } else {
                    resolve({
                        success: false,
                        error: data.error || 'Upload failed'
                    });
                }
            } catch (e) {
                resolve({ success: false, error: 'Upload failed' });
            }
        });

        xhr.addEventListener('error', () => {
            resolve({ success: false, error: 'Network error' });
        });

        xhr.open('POST', `${API_BASE}/upload`);
        xhr.send(formData);
    });
}

/**
 * Start a conversion task
 * @param {Array} files - Array of cached file info {fileId, url, filename, mimetype}
 * @param {string} model - Selected AI model
 * @returns {Promise<{success: boolean, taskId?: string, error?: string}>}
 */
async function startConversion(files, model) {
    try {
        const response = await fetch(`${API_BASE}/convert/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files, model })
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error || 'Failed to start conversion' };
        }

        return { success: true, taskId: data.taskId };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Get conversion task status
 * @param {string} taskId - Task ID
 * @returns {Promise<{status: string, markdown?: string, progress?: number, error?: string}>}
 */
async function getConversionStatus(taskId) {
    try {
        const response = await fetch(`${API_BASE}/convert/status/${taskId}`);
        const data = await response.json();

        if (!response.ok) {
            return { status: 'failed', error: data.error };
        }

        return {
            status: data.status,
            markdown: data.markdown,
            progress: data.progress,
            eta: data.eta,
            tps: data.tps,
            error: data.error
        };

    } catch (error) {
        return { status: 'failed', error: error.message };
    }
}

/**
 * Convert multiple files to markdown (legacy - for backwards compatibility)
 */
async function convertFiles(files, model, onProgress = () => { }) {
    try {
        onProgress(10);

        const formData = new FormData();
        formData.append('model', model);

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
 * Generate PDF from markdown
 */
async function generatePdf(markdown, filename = 'document') {
    try {
        const response = await fetch(`${API_BASE}/pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ markdown, filename })
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error || 'PDF generation failed' };
        }

        return {
            success: true,
            downloadLink: data.downloadLink,
            viewLink: data.viewLink,
            fileId: data.fileId
        };

    } catch (error) {
        return { success: false, error: error.message || 'PDF generation failed' };
    }
}

/**
 * Health check
 */
async function healthCheck() {
    try {
        const response = await fetch(`${API_BASE}/health`);
        return response.ok;
    } catch {
        return false;
    }
}

// Export
window.api = {
    uploadToCache,
    startConversion,
    getConversionStatus,
    convertFiles,
    generatePdf,
    healthCheck
};
