const { mdToPdf } = require('md-to-pdf');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const googleDriveService = require('./googleDrive'); // Import service

const TOKEN_PATH = path.join(__dirname, '../.google-token.json');

// PDF Generation CSS (same as frontend)
const PDF_CSS = `
body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  line-height: 1.6;
  padding: 40px;
  margin: 0;
  max-width: 800px;
  margin: 0 auto;
}
pre {
  background: #2d2d2d;
  color: #f8f8f2;
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
`;

/**
 * Convert markdown to PDF buffer
 * @param {string} markdown - Markdown content
 * @returns {Promise<Buffer>} - PDF buffer
 */
const katex = require('katex');

/**
 * Pre-process markdown for PDF generation:
 * 1. Render Math (LaTeX) to HTML on server-side using KaTeX
 * 2. Escape < followed by number in text parts (to prevent HTML tag confusion)
 */
function preprocessMarkdown(markdown) {
  const segments = [];
  // Regex matches $$...$$ (display) or $...$ (inline)
  // Inline math must not contain newlines
  const regex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(markdown)) !== null) {
    // Process text before math
    const textPart = markdown.slice(lastIndex, match.index);
    // Escape < followed by number only in text parts
    segments.push(textPart.replace(/<(\d)/g, '&lt;$1'));

    // Process math
    const mathContent = match[0];
    const isDisplay = mathContent.startsWith('$$');
    // Remove delimiters
    const tex = isDisplay ? mathContent.slice(2, -2) : mathContent.slice(1, -1);

    try {
      // Render to HTML directly
      const html = katex.renderToString(tex, {
        displayMode: isDisplay,
        throwOnError: false,
        output: 'html', // Generate semantic HTML
        strict: false
      });
      segments.push(html);
    } catch (e) {
      console.error('KaTeX rendering error:', e.message);
      segments.push(mathContent); // Fallback to raw tex
    }

    lastIndex = match.index + match[0].length;
  }

  // Process remaining text
  const textPart = markdown.slice(lastIndex);
  segments.push(textPart.replace(/<(\d)/g, '&lt;$1'));

  return segments.join('');
}

/**
 * Convert markdown to PDF buffer
 * @param {string} markdown - Markdown content
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function generatePdf(markdown) {
  // Pre-process markdown (SSR Math + Escaping)
  const safeMarkdown = preprocessMarkdown(markdown);

  // Serverless environment detection and chromium setup
  let launchOptions = {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
    ]
  };

  // Check if running in serverless environment (Vercel, AWS Lambda, etc.)
  const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (isServerless) {
    try {
      const chromium = require('@sparticuz/chromium');
      const executablePath = await chromium.executablePath();

      launchOptions = {
        ...launchOptions,
        executablePath,
        headless: chromium.headless,
        args: chromium.args
      };

      console.log('📦 Using @sparticuz/chromium for serverless PDF generation');
    } catch (e) {
      console.warn('⚠️ @sparticuz/chromium not available, falling back to default puppeteer');
    }
  }

  const result = await mdToPdf(
    { content: safeMarkdown },
    {
      css: PDF_CSS,
      // No client-side scripts needed for math anymore
      script: [],
      stylesheet: [
        'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',
        'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css'
      ],
      body_class: ['pdf-body'],
      launch_options: launchOptions,
      // Disable automatic highlight.js style inclusion (causes ENOENT on serverless)
      highlight_style: false,
      pdf_options: {
        format: 'A4',
        margin: {
          top: '0mm',
          bottom: '0mm',
          left: '0mm',
          right: '0mm'
        },
        printBackground: true
      },
      marked_options: {
        breaks: true,
        gfm: true
      }
    }
  );

  if (!result || !result.content) {
    throw new Error('PDF generation failed');
  }

  return result.content;
}

/**
 * Upload PDF to Google Drive and return public link
 * @param {Buffer} pdfBuffer - PDF content
 * @param {string} filename - File name (will be used as Drive filename)
 * @returns {Promise<{fileId: string, webViewLink: string, webContentLink: string}>}
 */
async function uploadToDrive(pdfBuffer, filename) {
  // Use provided filename, fallback to UUID if not provided
  let driveFilename;
  if (filename && filename.trim()) {
    // Ensure .pdf extension
    driveFilename = filename.endsWith('.pdf') ? filename : `${filename.replace(/\.[^/.]+$/, '')}.pdf`;
  } else {
    // Fallback to UUID
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
