const { marked } = require('marked');
const { processLatex } = require('../utils/latexToUnicode');

async function generateHtml(markdown, title) {
  const body = await marked.parse(processLatex(markdown), { breaks: true, gfm: true });
  const htmlTitle = title ? `<h1 style="font-size:2.2rem;font-weight:700;color:#1e293b;margin-bottom:1.5rem;">${title}</h1>` : '';
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title || 'LevTolstoy Export'}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:"Inter",system-ui,sans-serif;font-size:13pt;line-height:1.7;color:#1a1a1a;background:#fff;padding:2.5cm 3cm;max-width:100%}
  h1{font-size:2em;font-weight:700;margin:0 0 .5em;border-bottom:2px solid #0078d4;padding-bottom:.3em}
  h2{font-size:1.5em;font-weight:600;margin:1.5em 0 .5em}
  h3{font-size:1.2em;font-weight:600;margin:1.2em 0 .4em}
  h4,h5,h6{font-size:1em;font-weight:600;margin:1em 0 .3em}
  p{margin:.75em 0}
  a{color:#0078d4;text-decoration:underline}
  strong{font-weight:700} em{font-style:italic} del{text-decoration:line-through}
  code{font-family:"Cascadia Code","JetBrains Mono",monospace;font-size:.88em;background:#f0f0f0;padding:.1em .4em;border-radius:3px}
  pre{background:#1e1e1e;color:#d4d4d4;padding:1em 1.2em;border-radius:5px;overflow-x:auto;margin:1em 0;page-break-inside:avoid}
  pre code{background:none;padding:0;font-size:.85em}
  blockquote{border-left:4px solid #0078d4;padding:.5em 1.2em;margin:1em 0;color:#4a4a4a;background:#eff6fc;border-radius:0 4px 4px 0}
  ul,ol{padding-left:1.8em;margin:.75em 0} li{margin:.3em 0}
  table{border-collapse:collapse;width:100%;margin:1em 0;page-break-inside:avoid}
  th{background:#0078d4;color:#fff;font-weight:600;padding:.6em 1em;text-align:left}
  td{padding:.5em 1em;border-bottom:1px solid #e0e0e0}
  tr:nth-child(even) td{background:#f8f8f8}
  hr{border:none;border-top:1px solid #ccc;margin:1.5em 0}
  img{max-width:100%;height:auto;border-radius:4px}
  @media print{body{padding:0}a{color:#0078d4}pre{white-space:pre-wrap}}
</style>
</head>
<body>
${htmlTitle}
${body}
</body>
</html>`;
}

module.exports = { generateHtml };
