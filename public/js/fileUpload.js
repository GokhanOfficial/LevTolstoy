// File Upload Handler with Drag & Drop and Cache Upload

const SUPPORTED_EXTENSIONS = [
    '.pdf', '.pptx', '.docx', '.xlsx',
    '.png', '.jpg', '.jpeg', '.webp', '.gif',
    '.mp3', '.wav', '.ogg',
    '.txt', '.md'
];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// File state
let uploadedFiles = []; // Array of { file, status, progress, cacheInfo }

/**
 * Get file extension icon class
 */
function getFileIconClass(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'pdf') return 'pdf';
    if (['pptx', 'ppt'].includes(ext)) return 'pptx';
    if (['docx', 'doc'].includes(ext)) return 'docx';
    if (['xlsx', 'xls'].includes(ext)) return 'xlsx';
    if (['mp3', 'wav', 'ogg'].includes(ext)) return 'audio';
    if (['txt', 'md'].includes(ext)) return 'text';
    return 'image';
}

/**
 * Get file extension label
 */
function getFileExtLabel(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    return ext.toUpperCase();
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Validate file
 */
function validateFile(file) {
    const ext = '.' + file.name.toLowerCase().split('.').pop();

    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        return { valid: false, error: 'unsupported' };
    }

    if (file.size > MAX_FILE_SIZE) {
        return { valid: false, error: 'tooLarge' };
    }

    return { valid: true };
}

/**
 * Add file and start cache upload
 */
async function addFile(file) {
    const validation = validateFile(file);

    if (!validation.valid) {
        if (validation.error === 'tooLarge') {
            showToast('Dosya boyutu 100 MB limitini aşıyor', 'error');
        } else {
            showToast(window.i18n?.t('toast.unsupportedFormat') || 'Unsupported format', 'error');
        }
        return;
    }

    // Check for duplicates
    if (uploadedFiles.some(f => f.file.name === file.name && f.file.size === file.size)) {
        return;
    }

    const fileEntry = {
        file,
        status: 'uploading',
        progress: 0,
        cacheInfo: null
    };

    uploadedFiles.push(fileEntry);
    renderFileList();
    updateConvertButton();

    // Start cache upload
    try {
        const result = await window.api.uploadToCache(file, (progress) => {
            fileEntry.progress = progress;
            renderFileList();
        });

        if (result.success) {
            fileEntry.status = 'ready';
            fileEntry.cacheInfo = {
                fileId: result.fileId,
                url: result.url,
                filename: result.filename,
                mimetype: result.mimetype
            };
            console.log(`✅ Dosya cache'e yüklendi: ${file.name}`);
        } else {
            fileEntry.status = 'error';
            showToast(result.error || 'Upload failed', 'error');
        }
    } catch (error) {
        fileEntry.status = 'error';
        showToast(error.message || 'Upload failed', 'error');
    }

    renderFileList();
    updateConvertButton();
}

/**
 * Remove file from list
 */
function removeFile(index) {
    uploadedFiles.splice(index, 1);
    renderFileList();
    updateConvertButton();
}

/**
 * Render file list with progress
 */
function renderFileList() {
    const fileList = document.getElementById('file-list');

    if (uploadedFiles.length === 0) {
        fileList.classList.add('hidden');
        return;
    }

    fileList.classList.remove('hidden');
    fileList.innerHTML = uploadedFiles.map((entry, index) => {
        const statusClass = entry.status;
        let statusText = '';
        let progressHtml = '';

        switch (entry.status) {
            case 'uploading':
                statusText = `Yükleniyor... ${entry.progress}%`;
                progressHtml = `
                    <div class="w-20 h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div class="h-full bg-indigo-500 transition-all" style="width: ${entry.progress}%"></div>
                    </div>`;
                break;
            case 'ready':
                statusText = window.i18n?.t('status.ready') || 'Ready';
                break;
            case 'converting':
                statusText = window.i18n?.t('status.converting') || 'Converting';
                break;
            case 'done':
                statusText = window.i18n?.t('status.done') || 'Done';
                break;
            case 'error':
                statusText = window.i18n?.t('status.error') || 'Error';
                break;
        }

        return `
        <div class="file-item" data-index="${index}">
            <div class="flex items-center gap-3">
                <div class="file-icon ${getFileIconClass(entry.file.name)}">
                    ${getFileExtLabel(entry.file.name)}
                </div>
                <div>
                    <p class="font-medium text-slate-200 text-sm">${entry.file.name}</p>
                    <p class="text-xs text-slate-500">${formatFileSize(entry.file.size)}</p>
                </div>
            </div>
            <div class="flex items-center gap-3">
                ${progressHtml}
                <span class="status-badge ${statusClass}">${statusText}</span>
                <button class="remove-file text-slate-500 hover:text-red-400 transition-colors" data-index="${index}">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        </div>`;
    }).join('');

    // Add remove listeners
    fileList.querySelectorAll('.remove-file').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            removeFile(index);
        });
    });
}

/**
 * Update file status in list
 */
function updateFileStatus(index, status) {
    if (uploadedFiles[index]) {
        uploadedFiles[index].status = status;
        renderFileList();
    }
}

/**
 * Check if all files are ready (uploaded to cache)
 */
function allFilesReady() {
    return uploadedFiles.length > 0 && uploadedFiles.every(f => f.status === 'ready');
}

/**
 * Check if any file is still uploading
 */
function isUploading() {
    return uploadedFiles.some(f => f.status === 'uploading');
}

/**
 * Update convert button state
 */
function updateConvertButton() {
    const convertSection = document.getElementById('convert-section');
    const convertBtn = document.getElementById('convert-btn');

    if (uploadedFiles.length > 0) {
        convertSection.classList.remove('hidden');

        // Disable button while uploading
        if (isUploading()) {
            convertBtn.disabled = true;
            convertBtn.textContent = 'Dosyalar yükleniyor...';
        } else if (allFilesReady()) {
            convertBtn.disabled = false;
            convertBtn.textContent = window.i18n?.t('convert.button') || 'Start Conversion';
        }
    } else {
        convertSection.classList.add('hidden');
    }
}

/**
 * Get cached file info for conversion (includes ready and done files)
 */
function getCachedFiles() {
    return uploadedFiles
        .filter(f => (f.status === 'ready' || f.status === 'done' || f.status === 'error') && f.cacheInfo)
        .map(f => f.cacheInfo);
}

/**
 * Get uploaded files (raw File objects - for backwards compatibility)
 */
function getUploadedFiles() {
    return uploadedFiles.map(f => f.file);
}

/**
 * Clear all files
 */
function clearFiles() {
    uploadedFiles = [];
    renderFileList();
    updateConvertButton();
}

/**
 * Initialize drag & drop listeners
 */
function init(dropZone, fileInput) {
    if (!dropZone || !fileInput) return;

    // Click to select
    // Remove old listeners to avoid duplicates if possible, or rely on caller to clean up
    // Cloning nodes is a common trick to strip listeners

    const newDropZone = dropZone.cloneNode(true);
    dropZone.parentNode.replaceChild(newDropZone, dropZone);

    const newFileInput = fileInput.cloneNode(true);
    fileInput.parentNode.replaceChild(newFileInput, fileInput);

    newDropZone.addEventListener('click', () => newFileInput.click());

    // File input change
    newFileInput.addEventListener('change', (e) => {
        Array.from(e.target.files).forEach(addFile);
        e.target.value = ''; // Reset input
    });

    // Drag events
    newDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        newDropZone.classList.add('dragover');
    });

    newDropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        newDropZone.classList.remove('dragover');
    });

    newDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        newDropZone.classList.remove('dragover');

        const files = e.dataTransfer.files;
        Array.from(files).forEach(addFile);
    });

    return { dropZone: newDropZone, fileInput: newFileInput };
}



// Export functions
window.fileUpload = {
    init,
    getUploadedFiles,
    getCachedFiles,
    clearFiles,
    removeFile,
    updateFileStatus,
    allFilesReady,
    isUploading
};
