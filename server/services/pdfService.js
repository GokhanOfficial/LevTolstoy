const { mdToPdf } = require('md-to-pdf');
const crypto = require('crypto');
const config = require('../config');
const googleDriveService = require('./googleDrive');
const katex = require('katex');
const fs = require('fs');
const path = require('path');
const { PDFDocument, PDFName, PDFHexString } = require('pdf-lib');

// PDF Generation CSS - shared with frontend via pdf-preview.css
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
 * Extract metadata from markdown content
 * @param {string} markdown - Markdown content
 * @returns {{title?: string, subject?: string, keywords?: string[]}}
 */
function extractMetadata(markdown) {
  const metadata = {};

  // Extract title from first H1 heading
  const h1Match = markdown.match(/^#\s+(.+)$/m);
  if (h1Match) {
    metadata.title = h1Match[1].trim();
  }

  // Extract subject from first paragraph after title
  const lines = markdown.split('\n');
  let foundTitle = false;
  for (const line of lines) {
    if (line.startsWith('# ')) {
      foundTitle = true;
      continue;
    }
    if (foundTitle && line.trim() && !line.startsWith('#')) {
      metadata.subject = line.trim().slice(0, 200);
      break;
    }
  }

  // Extract keywords from H2/H3 headings
  const headingMatches = markdown.matchAll(/^#{2,3}\s+(.+)$/gm);
  const keywords = [];
  for (const match of headingMatches) {
    const heading = match[1].trim();
    // Only add unique keywords, max 10
    if (keywords.length < 10 && !keywords.includes(heading)) {
      keywords.push(heading);
    }
  }
  if (keywords.length > 0) {
    metadata.keywords = keywords;
  }

  return metadata;
}

/**
 * Set PDF metadata using pdf-lib
 * @param {Buffer} pdfBuffer - Original PDF buffer
 * @param {string} markdown - Source markdown for metadata extraction
 * @returns {Promise<Buffer>} - PDF buffer with updated metadata
 */
async function setPdfMetadata(pdfBuffer, markdown) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);

  // Set producer to LevTolstoy
  pdfDoc.setProducer('LevTolstoy');

  // Add website URL as custom metadata field in the Info dictionary
  const infoDict = pdfDoc.catalog.get(PDFName.of('Info'));
  if (infoDict) {
    const info = pdfDoc.context.lookup(infoDict);
    info.set(PDFName.of('Website'), PDFHexString.fromText('https://lev.gokhantekyildirim.me'));
  }

  // Extract and set metadata from markdown
  const metadata = extractMetadata(markdown);
  if (metadata.title) {
    pdfDoc.setTitle(metadata.title);
  }
  if (metadata.subject) {
    pdfDoc.setSubject(metadata.subject);
  }
  if (metadata.keywords && metadata.keywords.length > 0) {
    pdfDoc.setKeywords(metadata.keywords);
  }

  return Buffer.from(await pdfDoc.save());
}

/**
 * Convert markdown to PDF buffer using md-to-pdf
 * @param {string} markdown - Markdown content
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function generatePdf(markdown) {
  // Pre-process markdown (SSR Math + Escaping)
  const safeMarkdown = preprocessMarkdown(markdown);

  const result = await mdToPdf(
    { content: safeMarkdown },
    {
      css: PDF_CSS,
      script: [],
      stylesheet: [
        'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css'
      ],
      body_class: ['pdf-body'],
      highlight_style: 'github',
      launch_options: {
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      },
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

  // Apply metadata to PDF
  return setPdfMetadata(result.content, markdown);
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
  isConfigured,
  extractMetadata
};
