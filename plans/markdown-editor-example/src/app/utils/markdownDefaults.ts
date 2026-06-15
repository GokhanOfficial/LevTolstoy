export const DEFAULT_CONTENT = `# Welcome to Markdown Editor

A **powerful**, *feature-rich* Markdown editor with live preview — built with Fluent Design.

## Features

- ✅ Full Markdown syntax (Basic + Extended GFM)
- ✅ Live split-pane preview
- ✅ Export to PDF
- ✅ Open / Save files locally
- ✅ Google Drive integration
- ✅ Light, Dark, and High Contrast modes
- ✅ WCAG 2.1 AA accessible

---

## Text Formatting

**Bold**, *italic*, ***bold italic***, ~~strikethrough~~, and \`inline code\`.

Superscript: X^2^  |  Subscript: H~2~O

> **Blockquote** — Can span multiple lines and supports *inline formatting*.
>
> — Nested content works too.

## Code

\`\`\`typescript
interface MarkdownEditor {
  content: string;
  theme: 'light' | 'dark' | 'highContrast';
  onSave: (content: string) => void;
}

function renderMarkdown(md: string): string {
  return md.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
}
\`\`\`

## Tables

| Feature         | Supported | Notes                  |
|-----------------|:---------:|------------------------|
| Basic syntax    | ✅        | Headings, bold, italic |
| Tables          | ✅        | Alignment supported    |
| Task lists      | ✅        | Interactive checkboxes |
| Footnotes       | ✅        | Click to navigate      |
| Syntax highlight| ✅        | 100+ languages         |

## Task List

- [x] Create a new markdown file
- [x] Add content with rich formatting
- [ ] Save to Google Drive
- [ ] Export as PDF

## Links & Images

[Visit Markdown Guide](https://www.markdownguide.org) — external links open in a new tab.

## Footnotes

Here is a statement with a footnote.[^1]

[^1]: This is the footnote content, rendered at the bottom of the document.

---

*Start editing on the left to see changes reflected instantly on the right.*
`;
