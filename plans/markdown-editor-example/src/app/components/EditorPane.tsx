import React, { useRef, useEffect, useCallback, useState } from 'react';

interface EditorPaneProps {
  content: string;
  onChange: (value: string) => void;
  onCursorChange: (line: number, col: number) => void;
  onInsert?: (fn: (wrap: string, placeholder?: string) => void) => void;
}

export function EditorPane({ content, onChange, onCursorChange, onInsert }: EditorPaneProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [lineCount, setLineCount] = useState(1);

  const updateLineNumbers = useCallback((text: string) => {
    setLineCount(text.split('\n').length);
  }, []);

  useEffect(() => {
    updateLineNumbers(content);
  }, [content, updateLineNumbers]);

  const syncScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const updateCursor = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const text = el.value.substring(0, el.selectionStart);
    const lines = text.split('\n');
    onCursorChange(lines.length, lines[lines.length - 1].length + 1);
  }, [onCursorChange]);

  // Expose insert helper to parent via callback
  useEffect(() => {
    if (!onInsert) return;
    onInsert((wrap: string, placeholder = '') => {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const selected = el.value.substring(start, end) || placeholder;
      const before = el.value.substring(0, start);
      const after = el.value.substring(end);
      const newText = `${before}${wrap}${selected}${wrap}${after}`;
      onChange(newText);
      setTimeout(() => {
        el.focus();
        const cursor = start + wrap.length + selected.length;
        el.setSelectionRange(cursor, cursor);
      }, 0);
    });
  }, [onInsert, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const value = el.value;

    // Tab key — insert 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);
      setTimeout(() => {
        el.setSelectionRange(start + 2, start + 2);
      }, 0);
      return;
    }

    // Auto-pair characters
    const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
    if (pairs[e.key] && start === end) {
      e.preventDefault();
      const closing = pairs[e.key];
      const newValue = value.substring(0, start) + e.key + closing + value.substring(end);
      onChange(newValue);
      setTimeout(() => el.setSelectionRange(start + 1, start + 1), 0);
      return;
    }

    // Enter — continue list items
    if (e.key === 'Enter') {
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const currentLine = value.substring(lineStart, start);
      const listMatch = currentLine.match(/^(\s*)([-*+]|\d+\.)\s/);
      if (listMatch) {
        e.preventDefault();
        const indent = listMatch[1];
        const marker = listMatch[2];
        const nextMarker = /\d+/.test(marker) ? `${parseInt(marker) + 1}.` : marker;
        const insert = `\n${indent}${nextMarker} `;
        const newValue = value.substring(0, start) + insert + value.substring(end);
        onChange(newValue);
        setTimeout(() => {
          const pos = start + insert.length;
          el.setSelectionRange(pos, pos);
        }, 0);
      }
    }
  }, [onChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    updateLineNumbers(e.target.value);
  }, [onChange, updateLineNumbers]);

  return (
    <div
      className="flex h-full overflow-hidden"
      style={{ background: 'var(--editor-bg)', color: 'var(--editor-fg)' }}
    >
      {/* Line numbers */}
      <div
        ref={lineNumbersRef}
        aria-hidden="true"
        className="select-none overflow-hidden flex-shrink-0 pt-3 pb-3 pr-3 pl-3 text-right"
        style={{
          width: '3.5rem',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          lineHeight: '1.6',
          color: 'var(--editor-line-numbers)',
          background: 'var(--editor-line-bg)',
          borderRight: '1px solid var(--border)',
          overflowY: 'hidden',
        }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i + 1}>{i + 1}</div>
        ))}
      </div>

      {/* Editor textarea */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onScroll={syncScroll}
        onClick={updateCursor}
        onKeyUp={updateCursor}
        onSelect={updateCursor}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        aria-label="Markdown editor"
        aria-multiline="true"
        className="flex-1 resize-none outline-none p-3 overflow-auto"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          lineHeight: '1.6',
          background: 'var(--editor-bg)',
          color: 'var(--editor-fg)',
          caretColor: 'var(--primary)',
          tabSize: 2,
          whiteSpace: 'pre',
          border: 'none',
        }}
      />
    </div>
  );
}
