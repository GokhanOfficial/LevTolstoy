// File Upload Handler with Drag & Drop

const SUPPORTED_EXTENSIONS = [
    '.pdf', '.pptx', '.docx', '.xlsx',
    '.png', '.jpg', '.jpeg', '.webp', '.gif',
    '.mp3', '.wav',
    '.txt',
    '.mov', '.mpeg', '.mpg', '.mp4', '.avi', '.wmv', '.flv'
];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// File state
let uploadedFiles = [];

/**
 * Get file extension icon class
 */
function getFileIconClass(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'pdf') return 'pdf';
    if (['pptx', 'ppt'].includes(ext)) return 'pptx';
    if (['docx', 'doc'].includes(ext)) return 'docx';
    if (['xlsx', 'xls'].includes(ext)) return 'xlsx';
    if (['mp3', 'wav'].includes(ext)) return 'audio';
    if (['mp4', 'mov', 'mpeg', 'mpg', 'avi', 'wmv', 'flv'].includes(ext)) return 'video';
    if (['txt'].includes(ext)) return 'text';
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
 * Add file to list
 */
function addFile(file) {
    const validation = validateFile(file);

    if (!validation.valid) {
        showToast(window.i18n.t('toast.unsupportedFormat'), 'error');
        return;
    }

    // Check for duplicates
    if (uploadedFiles.some(f => f.name === file.name && f.size === file.size)) {
        return;
    }

    uploadedFiles.push(file);
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
 * Render file list
 */
function renderFileList() {
    const fileList = document.getElementById('file-list');

    if (uploadedFiles.length === 0) {
        fileList.classList.add('hidden');
        return;
    }

    fileList.classList.remove('hidden');
    fileList.innerHTML = uploadedFiles.map((file, index) => `
    <div class="file-item" data-index="${index}">
      <div class="flex items-center gap-3">
        <div class="file-icon ${getFileIconClass(file.name)}">
          ${getFileExtLabel(file.name)}
        </div>
        <div>
          <p class="font-medium text-slate-200 text-sm">${file.name}</p>
          <p class="text-xs text-slate-500">${formatFileSize(file.size)}</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <span class="status-badge ready">${window.i18n.t('status.ready')}</span>
        <button class="remove-file text-slate-500 hover:text-red-400 transition-colors" data-index="${index}">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    </div>
  `).join('');

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
    const fileItem = document.querySelector(`.file-item[data-index="${index}"]`);
    if (!fileItem) return;

    const badge = fileItem.querySelector('.status-badge');
    badge.className = `status-badge ${status}`;
    badge.textContent = window.i18n.t(`status.${status}`);
}

/**
 * Update convert button visibility
 */
function updateConvertButton() {
    const convertSection = document.getElementById('convert-section');
    if (uploadedFiles.length > 0) {
        convertSection.classList.remove('hidden');
    } else {
        convertSection.classList.add('hidden');
    }
}

/**
 * Get uploaded files
 */
function getUploadedFiles() {
    return uploadedFiles;
}

/**
 * Clear all files
 */
function clearFiles() {
    uploadedFiles = [];
    renderFileList();
    updateConvertButton();
}

// Initialize drag & drop
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    // Click to select
    dropZone.addEventListener('click', () => fileInput.click());

    // File input change
    fileInput.addEventListener('change', (e) => {
        Array.from(e.target.files).forEach(addFile);
        e.target.value = ''; // Reset input
    });

    // Drag events
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');

        const files = e.dataTransfer.files;
        Array.from(files).forEach(addFile);
    });

    // Update file list on language change
    window.addEventListener('languageChanged', renderFileList);
});

// Export functions
window.fileUpload = {
    getUploadedFiles,
    clearFiles,
    updateFileStatus
};
