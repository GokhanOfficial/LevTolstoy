// API Communication Layer

const API_BASE = '/api';

/**
 * Upload a file to cache with detailed progress and abort support.
 * @param {File} file
 * @param {Function} onProgress
 * @returns {{promise: Promise<object>, abort: Function}}
 */
function uploadToCache(file, onProgress = () => { }) {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    const startTime = Date.now();
    let lastLoaded = 0;
    let lastTime = startTime;

    formData.append('file', file);

    const promise = new Promise((resolve) => {
        xhr.upload.addEventListener('progress', (e) => {
            if (!e.lengthComputable) return;

            const now = Date.now();
            const elapsedSeconds = Math.max((now - startTime) / 1000, 0.001);
            const intervalSeconds = Math.max((now - lastTime) / 1000, 0.001);
            const instantSpeed = (e.loaded - lastLoaded) / intervalSeconds;
            const averageSpeed = e.loaded / elapsedSeconds;
            const remainingBytes = Math.max(e.total - e.loaded, 0);
            const etaSeconds = averageSpeed > 0 ? remainingBytes / averageSpeed : null;
            const percent = Math.round((e.loaded / e.total) * 100);

            lastLoaded = e.loaded;
            lastTime = now;

            onProgress({
                percent,
                loaded: e.loaded,
                total: e.total,
                speed: instantSpeed,
                averageSpeed,
                etaSeconds
            });
        });

        xhr.addEventListener('load', () => {
            try {
                const data = JSON.parse(xhr.responseText || '{}');
                if (xhr.status === 200 && data.success) {
                    resolve({
                        success: true,
                        fileId: data.fileId,
                        url: data.url,
                        filename: data.filename,
                        mimetype: data.mimetype,
                        size: data.size,
                        storage: data.storage,
                        s3Key: data.s3Key
                    });
                } else {
                    resolve({ success: false, error: data.error || 'Upload failed' });
                }
            } catch {
                resolve({ success: false, error: 'Upload failed' });
            }
        });

        xhr.addEventListener('abort', () => {
            resolve({ success: false, cancelled: true, error: 'Upload cancelled' });
        });

        xhr.addEventListener('error', () => {
            resolve({ success: false, error: 'Network error' });
        });

        xhr.open('POST', `${API_BASE}/upload`);
        xhr.send(formData);
    });

    return {
        promise,
        abort: () => xhr.abort()
    };
}

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

async function getConversionStatus(taskId) {
    try {
        const response = await fetch(`${API_BASE}/convert/status/${taskId}`);
        const data = await response.json();
        if (!response.ok) {
            return { status: 'failed', error: data.error };
        }
        return data;
    } catch (error) {
        return { status: 'failed', error: error.message };
    }
}

async function cancelConversion(taskId) {
    try {
        const response = await fetch(`${API_BASE}/convert/cancel/${taskId}`, { method: 'POST' });
        const data = await response.json();
        return { success: response.ok, ...data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function convertFiles(files, model, onProgress = () => { }) {
    try {
        onProgress(10);
        const formData = new FormData();
        formData.append('model', model);
        for (const file of files) formData.append('files', file);
        onProgress(30);
        const response = await fetch(`${API_BASE}/convert`, { method: 'POST', body: formData });
        onProgress(80);
        const data = await response.json();
        onProgress(100);
        if (!response.ok) {
            return { success: false, error: data.error || window.i18n?.t('errors.serverError') || 'Server error' };
        }
        return { success: true, markdown: data.markdown, filename: data.filename, stats: data.stats };
    } catch (error) {
        return { success: false, error: error.message || window.i18n?.t('errors.serverError') || 'Server error' };
    }
}

async function generatePdf(markdown, filename = 'document') {
    try {
        const response = await fetch(`${API_BASE}/pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ markdown, filename })
        });
        const data = await response.json();
        if (!response.ok) return { success: false, error: data.error || 'PDF generation failed' };
        return { success: true, url: data.url, s3Key: data.s3Key, filename: data.filename, storage: data.storage };
    } catch (error) {
        return { success: false, error: error.message || 'PDF generation failed' };
    }
}

async function healthCheck() {
    try {
        const response = await fetch(`${API_BASE}/health`);
        return response.ok;
    } catch {
        return false;
    }
}

window.api = {
    uploadToCache,
    startConversion,
    getConversionStatus,
    cancelConversion,
    convertFiles,
    generatePdf,
    healthCheck
};
