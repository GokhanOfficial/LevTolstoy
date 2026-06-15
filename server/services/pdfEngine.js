const PdfPrinter = require('pdfmake');
const vfs = require('pdfmake/build/vfs_fonts');
const htmlToPdfMake = require('html-to-pdfmake');
const { JSDOM } = require('jsdom');
const { marked } = require('marked');
const { processLatex } = require('../utils/latexToUnicode');

const fonts = {
  Roboto: {
    normal: Buffer.from(vfs['Roboto-Regular.ttf'], 'base64'),
    bold: Buffer.from(vfs['Roboto-Medium.ttf'], 'base64'),
    italics: Buffer.from(vfs['Roboto-Italic.ttf'], 'base64'),
    bolditalics: Buffer.from(vfs['Roboto-MediumItalic.ttf'], 'base64')
  }
};

const printer = new PdfPrinter(fonts);

async function generatePdf(markdown, title) {
  const html = await marked.parse(processLatex(markdown), { breaks: true, gfm: true });
  const dom = new JSDOM(html);
  const content = htmlToPdfMake(html, {
    window: dom.window,
    defaultStyles: {
      h1: { fontSize: 26, bold: true, margin: [0, 0, 0, 12], color: '#1e293b' },
      h2: { fontSize: 20, bold: true, margin: [0, 12, 0, 8], color: '#334155' },
      h3: { fontSize: 16, bold: true, margin: [0, 10, 0, 6], color: '#475569' },
      h4: { fontSize: 14, bold: true, margin: [0, 8, 0, 4], color: '#475569' },
      p: { margin: [0, 6, 0, 6], fontSize: 12, lineHeight: 1.6, color: '#334155' },
      a: { color: '#6366f1', decoration: 'underline' },
      strong: { bold: true },
      em: { italics: true },
      code: { fontSize: 10, background: '#1e293b', color: '#e2e8f0', margin: [0, 8, 0, 8], padding: [8, 8, 8, 8] },
      blockquote: { margin: [0, 8, 0, 8], color: '#4a4a4a', background: '#eff6ff', padding: [8, 12, 8, 12] },
      ul: { margin: [0, 6, 0, 6] },
      ol: { margin: [0, 6, 0, 6] },
      li: { margin: [0, 2, 0, 2] },
      table: { margin: [0, 8, 0, 8] },
      th: { bold: true, fillColor: '#6366f1', color: '#ffffff', padding: [6, 8, 6, 8] },
      td: { padding: [6, 8, 6, 8], borderBottom: [1, '#e2e8f0'] },
      hr: { margin: [0, 12, 0, 12], color: '#e2e8f0' },
      img: { margin: [0, 8, 0, 8] },
    },
  });

  const docDefinition = {
    content: title ? [{ text: title, style: 'header' }, content] : [content],
    defaultStyle: { font: 'Roboto', fontSize: 12, lineHeight: 1.6 },
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    info: { title: title || 'LevTolstoy Export', creator: 'LevTolstoy' },
    styles: {
      header: { fontSize: 32, bold: true, color: '#1e293b', margin: [0, 0, 0, 20] },
    },
  };

  return new Promise((resolve, reject) => {
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
}

module.exports = { generatePdf };
