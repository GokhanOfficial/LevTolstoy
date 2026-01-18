// Markdown Preview Handler

// Helper function for toast notifications
function _showToast(message, type = 'info') {
  if (window.showToast) {
    window.showToast(message, type);
  }
}

// PDF Export CSS
const PDF_STYLES = `
body {
  font-family: Barlow, sans-serif;
  line-height: 1.6;
  padding: 20px;
  margin: 0;
}
pre {
  background: #2d2d2d;
  border-radius: 4px;
  margin: 0.5em 0;
  padding: 1em;
  color: #f8f8f2;
}
code {
  font-family: 'Fira Code', Consolas, Monaco, monospace;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: anywhere;
}
:not(pre)>code {
  background: #f0f0f0;
  padding: 2px 4px;
  border-radius: 3px;
  color: #e83e8c;
}
img {
  max-width: 100%;
}
table {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
}
th, td {
  border: 1px solid #ddd;
  padding: 8px;
}
th {
  background-color: #f4f4f4;
}
blockquote {
  border-left: 4px solid #ddd;
  padding-left: 1em;
  margin-left: 0;
  color: #666;
}
h1 {
  font-size: 2.2em;
  color: #2c3e50;
  border-bottom: 2px solid #eee;
  padding-bottom: 0.5rem;
  margin: 1.5rem 0;
}
h2 {
  font-size: 1.8em;
  color: #34495e;
  margin: 1.5rem 0;
}
h3 {
  font-size: 1.4em;
  color: #455a64;
}
ul, ol {
  padding-left: 2em;
}
li {
  margin: 0.3em 0;
}
`;

// Configure marked
marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: true,
  mangle: false
});

/**
 * Render markdown to HTML
 */
function renderMarkdown(markdown) {
  try {
    const html = marked.parse(markdown);
    return html;
  } catch (error) {
    return `<p class="text-red-400">Markdown parse error: ${error.message}</p>`;
  }
}

/**
 * Update preview panel
 */
function updatePreview(markdown) {
  const previewContent = document.getElementById('preview-content');
  if (!previewContent) return;

  const html = renderMarkdown(markdown);
  previewContent.innerHTML = html;

  // Apply syntax highlighting to code blocks
  previewContent.querySelectorAll('pre code').forEach((block) => {
    hljs.highlightElement(block);
  });

  // Render LaTeX math expressions with KaTeX
  if (typeof renderMathInElement !== 'undefined') {
    renderMathInElement(previewContent, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false
    });
  }
}

/**
 * Copy markdown to clipboard
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    _showToast(window.i18n?.t('toast.copied') || 'Copied!', 'success');
    return true;
  } catch (error) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    _showToast(window.i18n?.t('toast.copied') || 'Copied!', 'success');
    return true;
  }
}

/**
 * Download markdown as file
 */
function downloadMarkdown(markdown, filename = 'document.md') {
  // Ensure .md extension
  if (!filename.endsWith('.md')) {
    filename = filename.replace(/\.[^/.]+$/, '') + '.md';
  }

  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
  _showToast(window.i18n?.t('toast.downloadStarted') || 'Download started', 'success');
}

/**
 * Download as PDF using server-side generation and Google Drive
 */
async function downloadPdf(markdown, filename = 'document.pdf') {
  // Ensure .pdf extension
  if (!filename.endsWith('.pdf')) {
    filename = filename.replace(/\.[^/.]+$/, '') + '.pdf';
  }

  _showToast(window.i18n?.t('toast.pdfGenerating') || 'PDF oluşturuluyor...', 'info');

  // Use server-side API if available
  if (window.api?.generatePdf) {
    const result = await window.api.generatePdf(markdown, filename);

    if (result.success && result.downloadLink) {
      // Open download link
      window.open(result.downloadLink, '_blank');
      _showToast(window.i18n?.t('toast.pdfReady') || 'PDF hazır!', 'success');
      return;
    } else if (result.error) {
      _showToast(result.error, 'error');
    }
  }

  // Fallback to browser print
  const html = renderMarkdown(markdown);
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${filename}</title>
      <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Fira+Code&display=swap" rel="stylesheet">
      <style>${PDF_STYLES}</style>
    </head>
    <body>
      ${html}
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
            window.close();
          }, 500);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
  _showToast(window.i18n?.t('toast.pdfReady') || 'PDF ready', 'success');
}

/**
 * Update character count
 */
function updateCharCount(markdown) {
  const charCount = document.getElementById('char-count');
  if (!charCount) return;

  const count = markdown.length;
  charCount.textContent = `${count.toLocaleString()} ${window.i18n?.t('file.characters') || 'characters'}`;
}

// Export
window.preview = {
  renderMarkdown,
  updatePreview,
  copyToClipboard,
  downloadMarkdown,
  downloadPdf,
  updateCharCount,
  PDF_STYLES
};

