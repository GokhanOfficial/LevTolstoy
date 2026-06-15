import React from 'react';
import {
  Bold, Italic, Strikethrough, Heading1, Heading2, Heading3,
  Link, Image, Code, Code2, Quote, List, ListOrdered, ListChecks,
  Minus, Table, Eye, EyeOff, PanelLeft, PanelRight,
} from 'lucide-react';

interface ToolbarAction {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  separator?: boolean;
}

interface ToolbarProps {
  onAction: (type: string) => void;
  showEditor: boolean;
  showPreview: boolean;
  onToggleEditor: () => void;
  onTogglePreview: () => void;
}

export function Toolbar({ onAction, showEditor, showPreview, onToggleEditor, onTogglePreview }: ToolbarProps) {
  const actions: ToolbarAction[] = [
    { icon: <Bold size={15} />, label: 'Bold (Ctrl+B)', onClick: () => onAction('bold') },
    { icon: <Italic size={15} />, label: 'Italic (Ctrl+I)', onClick: () => onAction('italic') },
    { icon: <Strikethrough size={15} />, label: 'Strikethrough', onClick: () => onAction('strike'), separator: true },
    { icon: <Heading1 size={15} />, label: 'Heading 1', onClick: () => onAction('h1') },
    { icon: <Heading2 size={15} />, label: 'Heading 2', onClick: () => onAction('h2') },
    { icon: <Heading3 size={15} />, label: 'Heading 3', onClick: () => onAction('h3'), separator: true },
    { icon: <Quote size={15} />, label: 'Blockquote', onClick: () => onAction('quote') },
    { icon: <Code size={15} />, label: 'Inline code', onClick: () => onAction('inlineCode') },
    { icon: <Code2 size={15} />, label: 'Code block', onClick: () => onAction('codeBlock'), separator: true },
    { icon: <List size={15} />, label: 'Unordered list', onClick: () => onAction('ul') },
    { icon: <ListOrdered size={15} />, label: 'Ordered list', onClick: () => onAction('ol') },
    { icon: <ListChecks size={15} />, label: 'Task list', onClick: () => onAction('task'), separator: true },
    { icon: <Link size={15} />, label: 'Insert link', onClick: () => onAction('link') },
    { icon: <Image size={15} />, label: 'Insert image', onClick: () => onAction('image') },
    { icon: <Table size={15} />, label: 'Insert table', onClick: () => onAction('table') },
    { icon: <Minus size={15} />, label: 'Horizontal rule', onClick: () => onAction('hr') },
  ];

  return (
    <div
      role="toolbar"
      aria-label="Formatting toolbar"
      className="flex items-center gap-0.5 px-2 py-1 border-b overflow-x-auto"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
        minHeight: '36px',
        flexShrink: 0,
      }}
    >
      {actions.map((action, i) => (
        <React.Fragment key={i}>
          {action.separator && (
            <div
              aria-hidden="true"
              className="w-px mx-1 self-stretch"
              style={{ background: 'var(--border)' }}
            />
          )}
          <button
            onClick={action.onClick}
            title={action.label}
            aria-label={action.label}
            className="flex items-center justify-center rounded transition-colors"
            style={{
              width: '28px',
              height: '28px',
              color: 'var(--muted-foreground)',
              background: 'transparent',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--muted)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--foreground)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted-foreground)';
            }}
          >
            {action.icon}
          </button>
        </React.Fragment>
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* View toggles */}
      <div
        aria-hidden="true"
        className="w-px mx-1 self-stretch"
        style={{ background: 'var(--border)' }}
      />
      <button
        onClick={onToggleEditor}
        title={showEditor ? 'Hide editor' : 'Show editor'}
        aria-label={showEditor ? 'Hide editor' : 'Show editor'}
        aria-pressed={showEditor}
        className="flex items-center justify-center rounded transition-colors"
        style={{
          width: '28px',
          height: '28px',
          color: showEditor ? 'var(--primary)' : 'var(--muted-foreground)',
          background: showEditor ? 'var(--accent)' : 'transparent',
        }}
      >
        <PanelLeft size={15} />
      </button>
      <button
        onClick={onTogglePreview}
        title={showPreview ? 'Hide preview' : 'Show preview'}
        aria-label={showPreview ? 'Hide preview' : 'Show preview'}
        aria-pressed={showPreview}
        className="flex items-center justify-center rounded transition-colors"
        style={{
          width: '28px',
          height: '28px',
          color: showPreview ? 'var(--primary)' : 'var(--muted-foreground)',
          background: showPreview ? 'var(--accent)' : 'transparent',
        }}
      >
        <PanelRight size={15} />
      </button>
    </div>
  );
}
