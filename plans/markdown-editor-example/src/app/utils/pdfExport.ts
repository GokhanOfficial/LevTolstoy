export function exportToPdf(fileName: string, previewHtml: string): void {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    alert('Please allow pop-ups to export as PDF.');
    return;
  }

  const title = fileName.replace(/\.md$/i, '');

  printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: "Segoe UI", "Inter", system-ui, sans-serif;
      font-size: 13pt;
      line-height: 1.7;
      color: #1A1A1A;
      background: #FFFFFF;
      padding: 2.5cm 3cm;
      max-width: 100%;
    }

    h1 { font-size: 2em; font-weight: 700; margin: 0 0 0.5em; border-bottom: 2px solid #0078D4; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; font-weight: 600; margin: 1.5em 0 0.5em; }
    h3 { font-size: 1.2em; font-weight: 600; margin: 1.2em 0 0.4em; }
    h4, h5, h6 { font-size: 1em; font-weight: 600; margin: 1em 0 0.3em; }

    p { margin: 0.75em 0; }
    a { color: #0078D4; text-decoration: underline; }

    strong { font-weight: 700; }
    em { font-style: italic; }
    del { text-decoration: line-through; }
    code {
      font-family: "Cascadia Code", "JetBrains Mono", monospace;
      font-size: 0.88em;
      background: #F0F0F0;
      padding: 0.1em 0.4em;
      border-radius: 3px;
    }
    pre {
      background: #1E1E1E;
      color: #D4D4D4;
      padding: 1em 1.2em;
      border-radius: 5px;
      overflow-x: auto;
      margin: 1em 0;
      page-break-inside: avoid;
    }
    pre code { background: none; padding: 0; font-size: 0.85em; }

    blockquote {
      border-left: 4px solid #0078D4;
      padding: 0.5em 1.2em;
      margin: 1em 0;
      color: #4A4A4A;
      background: #EFF6FC;
      border-radius: 0 4px 4px 0;
    }

    ul, ol { padding-left: 1.8em; margin: 0.75em 0; }
    li { margin: 0.3em 0; }
    li input[type="checkbox"] { margin-right: 0.5em; }

    table { border-collapse: collapse; width: 100%; margin: 1em 0; page-break-inside: avoid; }
    th { background: #0078D4; color: #FFFFFF; font-weight: 600; padding: 0.6em 1em; text-align: left; }
    td { padding: 0.5em 1em; border-bottom: 1px solid #E0E0E0; }
    tr:nth-child(even) td { background: #F8F8F8; }

    hr { border: none; border-top: 1px solid #CCCCCC; margin: 1.5em 0; }
    img { max-width: 100%; height: auto; border-radius: 4px; }

    @media print {
      body { padding: 0; }
      a { color: #0078D4; }
      pre { white-space: pre-wrap; }
    }
  </style>
</head>
<body>
  ${previewHtml}
</body>
</html>`);

  printWindow.document.close();

  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 500);
}
