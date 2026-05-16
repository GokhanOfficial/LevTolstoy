// File Upload Handler with Drag & Drop and Cache Upload

const SUPPORTED_EXTENSIONS = [
    '.pdf', '.pptx', '.ppt', '.docx', '.doc', '.xlsx', '.xls',
    '.png', '.jpg', '.jpeg', '.webp', '.gif',
    '.mp3', '.wav', '.ogg',
    '.m4a', '.aac', '.opus', '.flac', '.oga', '.weba',
    '.mp4', '.avi', '.mkv', '.mov', '.webm', '.3gp', '.m4v', '.mpeg', '.mpg', '.wmv', '.flv',
    '.txt', '.md'
];
const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB

let uploadedFiles = [];

function getFileIconClass(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'pdf') return 'pdf';
    if (['pptx', 'ppt'].includes(ext)) return 'pptx';
    if (['docx', 'doc'].includes(ext)) return 'docx';
    if (['xlsx', 'xls'].includes(ext)) return 'xlsx';
    if (['mp3', 'wav', 'm4a', 'aac', 'opus', 'flac', 'ogg', 'oga', 'weba'].includes(ext)) return 'audio';
    if (['mp4', 'avi', 'mkv', 'mov', 'webm', '3gp', 'm4v', 'mpeg', 'mpg', 'wmv', 'flv'].includes(ext)) return 'video';
    if (['txt', 'md'].includes(ext)) return 'text';
    return 'image';
}

function getFileExtLabel(filename) {
    return filename.toLowerCase().split('.').pop().toUpperCase();
}

function formatFileSize(bytes) {
    if (!Number.isFinite(bytes)) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '-';
    if (seconds < 60) return `${Math.ceil(seconds)} sn`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${minutes} dk ${secs} sn`;
}

function validateFile(file) {
    const ext = '.' + file.name.toLowerCase().split('.').pop();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) return { valid: false, error: 'unsupported' };
    if (file.size > MAX_FILE_SIZE) return { valid: false, error: 'tooLarge' };
    return { valid: true };
}

async function addFile(file) {
    const validation = validateFile(file);
    if (!validation.valid) {
        if (validation.error === 'tooLarge') showToast('Dosya boyutu 1 GB limitini aşıyor', 'error');
        else showToast(window.i18n?.t('toast.unsupportedFormat') || 'Unsupported format', 'error');
        return;
    }

    if (uploadedFiles.some(f => f.file.name === file.name && f.file.size === file.size)) return;

    const fileEntry = {
        file,
        status: 'uploading',
        progress: 0,
        upload: { loaded: 0, total: file.size, speed: 0, averageSpeed: 0, etaSeconds: null },
        cacheInfo: null,
        uploadController: null
    };

    uploadedFiles.push(fileEntry);
    renderFileList();
    updateConvertButton();

    try {
        const upload = window.api.uploadToCache(file, (progress) => {
            fileEntry.progress = progress.percent;
            fileEntry.upload = progress;
            renderFileList();
        });
        fileEntry.uploadController = upload;
        const result = await upload.promise;

        if (result.success) {
            fileEntry.status = 'ready';
            fileEntry.progress = 100;
            fileEntry.cacheInfo = {
                fileId: result.fileId,
                url: result.url,
                filename: result.filename,
                mimetype: result.mimetype,
                storage: result.storage,
                s3Key: result.s3Key
            };
            console.log(`✅ Dosya cache'e yüklendi: ${file.name}`);
        } else if (result.cancelled) {
            fileEntry.status = 'cancelled';
        } else {
            fileEntry.status = 'error';
            showToast(result.error || 'Upload failed', 'error');
        }
    } catch (error) {
        fileEntry.status = 'error';
        showToast(error.message || 'Upload failed', 'error');
    } finally {
        fileEntry.uploadController = null;
    }

    renderFileList();
    updateConvertButton();
}

function removeFile(index) {
    const entry = uploadedFiles[index];
    if (entry?.status === 'uploading' && entry.uploadController) {
        entry.uploadController.abort();
    }
    uploadedFiles.splice(index, 1);
    renderFileList();
    updateConvertButton();
}

function getUploadDetail(entry) {
    if (entry.status !== 'uploading') return '';
    const loaded = formatFileSize(entry.upload.loaded || 0);
    const total = formatFileSize(entry.upload.total || entry.file.size);
    const speed = formatFileSize(entry.upload.averageSpeed || entry.upload.speed || 0) + '/sn';
    const eta = formatDuration(entry.upload.etaSeconds);
    return `Yüklenen: ${loaded} / ${total} • Hız: ${speed} • Kalan süre: ${eta}`;
}

function renderFileList() {
    const fileList = document.getElementById('file-list');
    if (!fileList) return;

    if (uploadedFiles.length === 0) {
        fileList.classList.add('hidden');
        return;
    }

    fileList.classList.remove('hidden');
    fileList.innerHTML = uploadedFiles.map((entry, index) => {
        const statusClass = entry.status;
        let statusText = '';
        let progressHtml = '';
        let detailText = getUploadDetail(entry);

        switch (entry.status) {
            case 'uploading':
                statusText = `Yükleniyor... ${entry.progress}%`;
                progressHtml = `<div class="w-24 h-1 bg-slate-700 rounded-full overflow-hidden"><div class="h-full bg-indigo-500 transition-all" style="width: ${entry.progress}%"></div></div>`;
                break;
            case 'ready': statusText = window.i18n?.t('status.ready') || 'Ready'; break;
            case 'converting': statusText = window.i18n?.t('status.converting') || 'Converting'; break;
            case 'done': statusText = window.i18n?.t('status.done') || 'Done'; break;
            case 'cancelled': statusText = 'İptal edildi'; break;
            case 'error': statusText = window.i18n?.t('status.error') || 'Error'; break;
        }

        return `
        <div class="file-item flex-col sm:flex-row sm:items-center gap-3" data-index="${index}">
            <div class="flex items-center gap-3 min-w-0 flex-1">
                <div class="file-icon ${getFileIconClass(entry.file.name)}">${getFileExtLabel(entry.file.name)}</div>
                <div class="min-w-0 flex-1">
                    <p class="font-medium text-slate-200 text-sm truncate">${entry.file.name}</p>
                    <p class="text-xs text-slate-500">${formatFileSize(entry.file.size)}</p>
                    ${detailText ? `<p class="text-xs text-indigo-300 mt-1 whitespace-normal">${detailText}</p>` : ''}
                </div>
            </div>
            <div class="flex items-center gap-3 self-end sm:self-auto">
                ${progressHtml}
                <span class="status-badge ${statusClass}">${statusText}</span>
                <button class="remove-file text-slate-500 hover:text-red-400 transition-colors" data-index="${index}" title="${entry.status === 'uploading' ? 'Yüklemeyi iptal et' : 'Kaldır'}">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
        </div>`;
    }).join('');

    fileList.querySelectorAll('.remove-file').forEach(btn => {
        btn.addEventListener('click', (e) => removeFile(parseInt(e.currentTarget.dataset.index)));
    });
}

function updateFileStatus(index, status) {
    if (uploadedFiles[index]) {
        uploadedFiles[index].status = status;
        renderFileList();
    }
}

function allFilesReady() {
    return uploadedFiles.length > 0 && uploadedFiles.every(f => f.status === 'ready');
}

function isUploading() {
    return uploadedFiles.some(f => f.status === 'uploading');
}

function updateConvertButton() {
    const convertSection = document.getElementById('convert-section');
    const convertBtn = document.getElementById('convert-btn');
    if (!convertSection || !convertBtn) return;

    if (uploadedFiles.length > 0) {
        convertSection.classList.remove('hidden');
        if (isUploading()) {
            convertBtn.disabled = true;
            convertBtn.textContent = 'Dosyalar yükleniyor...';
        } else if (allFilesReady()) {
            convertBtn.disabled = false;
            convertBtn.textContent = window.i18n?.t('convert.button') || 'Start Conversion';
        } else {
            convertBtn.disabled = true;
            convertBtn.textContent = 'Hazır dosya yok';
        }
    } else {
        convertSection.classList.add('hidden');
    }
}

function getCachedFiles() {
    return uploadedFiles
        .filter(f => (f.status === 'ready' || f.status === 'done' || f.status === 'error') && f.cacheInfo)
        .map(f => f.cacheInfo);
}

function getUploadedFiles() {
    return uploadedFiles.map(f => f.file);
}

function clearFiles() {
    uploadedFiles.forEach(entry => {
        if (entry.status === 'uploading' && entry.uploadController) entry.uploadController.abort();
    });
    uploadedFiles = [];
    renderFileList();
    updateConvertButton();
}

function init(dropZone, fileInput) {
    if (!dropZone || !fileInput) return;

    const newDropZone = dropZone.cloneNode(true);
    dropZone.parentNode.replaceChild(newDropZone, dropZone);
    const newFileInput = fileInput.cloneNode(true);
    fileInput.parentNode.replaceChild(newFileInput, fileInput);

    newDropZone.addEventListener('click', () => newFileInput.click());
    newFileInput.addEventListener('change', (e) => {
        Array.from(e.target.files).forEach(addFile);
        e.target.value = '';
    });
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
        Array.from(e.dataTransfer.files).forEach(addFile);
    });

    return { dropZone: newDropZone, fileInput: newFileInput };
}

window.fileUpload = {
    init,
    getUploadedFiles,
    getCachedFiles,
    clearFiles,
    removeFile,
    updateFileStatus,
    allFilesReady,
    isUploading,
    formatFileSize,
    formatDuration
};
