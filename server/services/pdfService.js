const { marked } = require('marked');
const puppeteer = require('puppeteer');
const crypto = require('crypto');
const config = require('../config');
const googleDriveService = require('./googleDrive');
const katex = require('katex');

// PDF Generation CSS (includes highlight.js github theme inlined)
const PDF_CSS = `
/* Base styles */
body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  line-height: 1.6;
  padding: 40px;
  margin: 0;
  max-width: 800px;
  margin: 0 auto;
}
pre {
  background: #f6f8fa;
  border-radius: 4px;
  margin: 0.5em 0;
  padding: 1em;
  overflow-x: auto;
}
code {
  font-family: 'Fira Code', Consolas, Monaco, monospace;
  font-size: 0.9em;
}
:not(pre)>code {
  background: #f0f0f0;
  padding: 2px 6px;
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
  padding: 10px;
}
th {
  background-color: #f4f4f4;
  font-weight: 600;
}
blockquote {
  border-left: 4px solid #6366f1;
  padding-left: 1em;
  margin-left: 0;
  color: #666;
  font-style: italic;
}
h1 {
  font-size: 2em;
  color: #1e293b;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 0.5rem;
  margin: 1.5rem 0 1rem 0;
}
h2 {
  font-size: 1.5em;
  color: #334155;
  margin: 1.5rem 0 0.75rem 0;
}
h3 {
  font-size: 1.25em;
  color: #475569;
  margin: 1.25rem 0 0.5rem 0;
}
ul, ol {
  padding-left: 2em;
}
li {
  margin: 0.3em 0;
}
a {
  color: #6366f1;
}
hr {
  border: none;
  border-top: 1px solid #e2e8f0;
  margin: 2rem 0;
}

/* Highlight.js GitHub Theme (inlined) */
.hljs{color:#24292e;background:#f6f8fa}.hljs-doctag,.hljs-keyword,.hljs-meta .hljs-keyword,.hljs-template-tag,.hljs-template-variable,.hljs-type,.hljs-variable.language_{color:#d73a49}.hljs-title,.hljs-title.class_,.hljs-title.class_.inherited__,.hljs-title.function_{color:#6f42c1}.hljs-attr,.hljs-attribute,.hljs-literal,.hljs-meta,.hljs-number,.hljs-operator,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id,.hljs-variable{color:#005cc5}.hljs-meta .hljs-string,.hljs-regexp,.hljs-string{color:#032f62}.hljs-built_in,.hljs-symbol{color:#e36209}.hljs-code,.hljs-comment,.hljs-formula{color:#6a737d}.hljs-name,.hljs-quote,.hljs-selector-pseudo,.hljs-selector-tag{color:#22863a}.hljs-subst{color:#24292e}.hljs-section{color:#005cc5;font-weight:700}.hljs-bullet{color:#735c0f}.hljs-emphasis{color:#24292e;font-style:italic}.hljs-strong{color:#24292e;font-weight:700}.hljs-addition{color:#22863a;background-color:#f0fff4}.hljs-deletion{color:#b31d28;background-color:#ffeef0}
`;

/**
 * Pre-process markdown for PDF generation:
 * 1. Render Math (LaTeX) to HTML on server-side using KaTeX
 * 2. Escape < followed by number in text parts
 */
function preprocessMarkdown(markdown) {
  const segments = [];
  const regex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(markdown)) !== null) {
    const textPart = markdown.slice(lastIndex, match.index);
    segments.push(textPart.replace(/<(\d)/g, '&lt;$1'));

    const mathContent = match[0];
    const isDisplay = mathContent.startsWith('$$');
    const tex = isDisplay ? mathContent.slice(2, -2) : mathContent.slice(1, -1);

    try {
      const html = katex.renderToString(tex, {
        displayMode: isDisplay,
        throwOnError: false,
        output: 'html',
        strict: false
      });
      segments.push(html);
    } catch (e) {
      console.error('KaTeX rendering error:', e.message);
      segments.push(mathContent);
    }

    lastIndex = match.index + match[0].length;
  }

  const textPart = markdown.slice(lastIndex);
  segments.push(textPart.replace(/<(\d)/g, '&lt;$1'));

  return segments.join('');
}

/**
 * Convert markdown to PDF buffer using marked + puppeteer
 * @param {string} markdown - Markdown content
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function generatePdf(markdown) {
  // Pre-process markdown (SSR Math + Escaping)
  const safeMarkdown = preprocessMarkdown(markdown);

  // Configure marked
  marked.setOptions({
    breaks: true,
    gfm: true
  });

  // Convert markdown to HTML
  const htmlContent = marked.parse(safeMarkdown);

  // Build full HTML document
  const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <style>${PDF_CSS}</style>
</head>
<body class="pdf-body">
  ${htmlContent}
</body>
</html>
  `;

  // Launch puppeteer with serverless-compatible options
  let browser;
  try {
    const launchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    };

    // Check if running in serverless environment
    const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

    if (isServerless) {
      try {
        const chromium = require('@sparticuz/chromium');
        launchOptions.executablePath = await chromium.executablePath();
        launchOptions.args = chromium.args;
        launchOptions.headless = chromium.headless;
        console.log('📦 Using @sparticuz/chromium for serverless PDF generation');
      } catch (e) {
        console.warn('⚠️ @sparticuz/chromium not available, using default puppeteer');
      }
    }

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    // Set content and wait for styles to load
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '0mm',
        bottom: '0mm',
        left: '0mm',
        right: '0mm'
      },
      printBackground: true
    });

    return Buffer.from(pdfBuffer);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Upload PDF to Google Drive
 * @param {Buffer} pdfBuffer - PDF content
 * @param {string} filename - File name
 * @returns {Promise<{fileId: string}>}
 */
async function uploadToDrive(pdfBuffer, filename) {
  let driveFilename;
  if (filename && filename.trim()) {
    driveFilename = filename.endsWith('.pdf') ? filename : `${filename.replace(/\.[^/.]+$/, '')}.pdf`;
  } else {
    const uuid = crypto.randomUUID();
    driveFilename = `${uuid}.pdf`;
  }

  const folderId = config.googleDrive.pdfFolderId;

  const result = await googleDriveService.uploadFile(
    pdfBuffer,
    driveFilename,
    'application/pdf',
    folderId
  );

  return {
    fileId: result.fileId
  };
}

/**
 * Check if Drive is configured
 */
function isConfigured() {
  return googleDriveService.isConfigured();
}

module.exports = {
  generatePdf,
  uploadToDrive,
  isConfigured
};
