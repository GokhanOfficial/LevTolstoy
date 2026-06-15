// MARKER-MAKE-KIT-INVOKED
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Toaster, toast } from 'sonner';

import { MenuBar } from './components/MenuBar';
import { Toolbar } from './components/Toolbar';
import { EditorPane } from './components/EditorPane';
import { PreviewPane, PreviewPaneRef } from './components/PreviewPane';
import { StatusBar } from './components/StatusBar';
import { GoogleDriveDialog } from './components/GoogleDriveDialog';
import { DEFAULT_CONTENT } from './utils/markdownDefaults';
import { exportToPdf } from './utils/pdfExport';

type Theme = 'light' | 'dark' | 'highContrast';

interface HistoryEntry { content: string; }

// ── Google Drive API helpers ──────────────────────────────────────────────────

async function driveCreateFile(token: string, name: string, content: string): Promise<string> {
  const metadata = { name, mimeType: 'text/markdown' };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: 'text/markdown' }));
  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
  );
  if (!res.ok) throw new Error(`Drive create error: ${res.status}`);
  const data = await res.json();
  return data.id;
}

async function driveUpdateFile(token: string, fileId: string, content: string): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/markdown' },
      body: content,
    }
  );
  if (!res.ok) throw new Error(`Drive update error: ${res.status}`);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function App() {
  const [content, setContent] = useState<string>(DEFAULT_CONTENT);
  const [fileName, setFileName] = useState<string>('welcome.md');
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [currentDriveFileId, setCurrentDriveFileId] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>('light');
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [googleUser, setGoogleUser] = useState<{ name: string; email: string } | null>(null);
  const [showEditor, setShowEditor] = useState<boolean>(true);
  const [showPreview, setShowPreview] = useState<boolean>(true);
  const [driveDialog, setDriveDialog] = useState<false | 'open' | 'save'>(false);
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });

  // Undo/redo history
  const historyRef = useRef<HistoryEntry[]>([{ content: DEFAULT_CONTENT }]);
  const historyIndexRef = useRef<number>(0);

  // Insert function injected from EditorPane
  const insertRef = useRef<((wrap: string, placeholder?: string) => void) | null>(null);
  const insertLineRef = useRef<((prefix: string, placeholder?: string) => void) | null>(null);

  const previewRef = useRef<PreviewPaneRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Apply theme class to document root
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'high-contrast');
    if (theme === 'dark') root.classList.add('dark');
    if (theme === 'highContrast') root.classList.add('high-contrast');
  }, [theme]);

  // Persist theme preference
  useEffect(() => {
    const saved = localStorage.getItem('md-editor-theme') as Theme | null;
    if (saved) setTheme(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem('md-editor-theme', theme);
  }, [theme]);

  // Dirty tracking
  const handleContentChange = useCallback((value: string) => {
    setContent(value);
    setIsDirty(true);

    // Push to history (debounced by character count change)
    const history = historyRef.current;
    const idx = historyIndexRef.current;
    if (history[idx].content !== value) {
      const newHistory = history.slice(0, idx + 1);
      newHistory.push({ content: value });
      if (newHistory.length > 200) newHistory.shift();
      historyRef.current = newHistory;
      historyIndexRef.current = newHistory.length - 1;
    }
  }, []);

  const handleUndo = useCallback(() => {
    const idx = historyIndexRef.current;
    if (idx > 0) {
      historyIndexRef.current = idx - 1;
      setContent(historyRef.current[idx - 1].content);
    }
  }, []);

  const handleRedo = useCallback(() => {
    const idx = historyIndexRef.current;
    if (idx < historyRef.current.length - 1) {
      historyIndexRef.current = idx + 1;
      setContent(historyRef.current[idx + 1].content);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'n') { e.preventDefault(); handleNew(); }
        if (e.key === 's') { e.preventDefault(); handleSaveLocal(); }
        if (e.key === 'z') { e.preventDefault(); handleUndo(); }
        if (e.key === 'y') { e.preventDefault(); handleRedo(); }
        if (e.key === 'b') { e.preventDefault(); handleToolbarAction('bold'); }
        if (e.key === 'i') { e.preventDefault(); handleToolbarAction('italic'); }
        if (e.shiftKey && e.key === 'P') { e.preventDefault(); handleExportPdf(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── File operations ─────────────────────────────────────────────────────────

  const handleNew = useCallback(() => {
    if (isDirty && !window.confirm('You have unsaved changes. Start a new file anyway?')) return;
    setContent('# New Document\n\nStart writing here…\n');
    setFileName('untitled.md');
    setIsDirty(false);
    setCurrentDriveFileId(null);
    historyRef.current = [{ content: '# New Document\n\nStart writing here…\n' }];
    historyIndexRef.current = 0;
  }, [isDirty]);

  const handleOpenLocal = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      setContent(text);
      setFileName(file.name);
      setIsDirty(false);
      setCurrentDriveFileId(null);
      historyRef.current = [{ content: text }];
      historyIndexRef.current = 0;
      toast.success(`Opened "${file.name}"`);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const handleSaveLocal = useCallback(() => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    setIsDirty(false);
    toast.success(`Saved "${fileName}" locally`);
  }, [content, fileName]);

  const handleExportPdf = useCallback(() => {
    const html = previewRef.current?.getHtml() ?? '';
    exportToPdf(fileName, html);
    toast.info('Opening print dialog for PDF export…');
  }, [fileName]);

  // ── Google Drive ────────────────────────────────────────────────────────────

  const handleTokenChange = useCallback((token: string | null, userInfo?: { name: string; email: string }) => {
    setGoogleToken(token);
    setGoogleUser(userInfo ?? null);
    if (token) toast.success(`Signed in as ${userInfo?.name ?? 'Google user'}`);
    else toast.info('Signed out of Google');
  }, []);

  const handleGoogleSignIn = useCallback(() => {
    setDriveDialog('open');
  }, []);

  const handleGoogleSignOut = useCallback(() => {
    handleTokenChange(null);
  }, [handleTokenChange]);

  const handleDriveFileOpen = useCallback((fileContent: string, name: string, fileId: string) => {
    setContent(fileContent);
    setFileName(name);
    setCurrentDriveFileId(fileId);
    setIsDirty(false);
    historyRef.current = [{ content: fileContent }];
    historyIndexRef.current = 0;
    toast.success(`Opened "${name}" from Google Drive`);
  }, []);

  const handleDriveFileSave = useCallback(async (fileId: string | null, name: string): Promise<string> => {
    if (!googleToken) throw new Error('Not signed in to Google');
    const nameWithExt = name.endsWith('.md') ? name : name + '.md';
    let id: string;
    if (fileId) {
      await driveUpdateFile(googleToken, fileId, content);
      id = fileId;
    } else {
      id = await driveCreateFile(googleToken, nameWithExt, content);
    }
    setFileName(nameWithExt);
    setCurrentDriveFileId(id);
    setIsDirty(false);
    toast.success(`Saved "${nameWithExt}" to Google Drive`);
    return id;
  }, [googleToken, content]);

  // ── Toolbar / format actions ────────────────────────────────────────────────

  const handleToolbarAction = useCallback((type: string) => {
    const ins = insertRef.current;
    if (!ins) return;

    const actions: Record<string, () => void> = {
      bold: () => ins('**', 'bold text'),
      italic: () => ins('*', 'italic text'),
      strike: () => ins('~~', 'strikethrough'),
      inlineCode: () => ins('`', 'code'),
      codeBlock: () => {
        setContent(c => c + '\n\n```\ncode here\n```\n');
        setIsDirty(true);
      },
      quote: () => {
        setContent(c => c + '\n> blockquote\n');
        setIsDirty(true);
      },
      h1: () => { setContent(c => c + '\n# Heading 1\n'); setIsDirty(true); },
      h2: () => { setContent(c => c + '\n## Heading 2\n'); setIsDirty(true); },
      h3: () => { setContent(c => c + '\n### Heading 3\n'); setIsDirty(true); },
      ul: () => { setContent(c => c + '\n- List item\n'); setIsDirty(true); },
      ol: () => { setContent(c => c + '\n1. List item\n'); setIsDirty(true); },
      task: () => { setContent(c => c + '\n- [ ] Task item\n'); setIsDirty(true); },
      hr: () => { setContent(c => c + '\n\n---\n\n'); setIsDirty(true); },
      link: () => { setContent(c => c + '[link text](https://example.com)'); setIsDirty(true); },
      image: () => { setContent(c => c + '![alt text](https://example.com/image.png)'); setIsDirty(true); },
      table: () => {
        setContent(c => c + '\n\n| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n\n');
        setIsDirty(true);
      },
    };

    actions[type]?.();
  }, []);

  // Computed stats
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  const isDark = theme === 'dark' || theme === 'highContrast';

  return (
    <div
      className="flex flex-col h-screen w-full overflow-hidden"
      style={{ background: 'var(--background)' }}
    >
      {/* Skip to content link for keyboard users */}
      <a
        href="#editor-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded"
        style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
      >
        Skip to editor
      </a>

      {/* Hidden file input for local open */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.txt"
        className="hidden"
        aria-hidden="true"
        onChange={handleFileInputChange}
      />

      {/* Menu bar */}
      <MenuBar
        fileName={fileName}
        isDirty={isDirty}
        isGoogleSignedIn={!!googleToken}
        theme={theme}
        showEditor={showEditor}
        showPreview={showPreview}
        onNew={handleNew}
        onOpenLocal={handleOpenLocal}
        onOpenDrive={() => setDriveDialog('open')}
        onSaveLocal={handleSaveLocal}
        onSaveDrive={() => setDriveDialog('save')}
        onExportPdf={handleExportPdf}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleSignOut={handleGoogleSignOut}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onAction={handleToolbarAction}
        onThemeChange={setTheme}
        onToggleEditor={() => setShowEditor(v => !v)}
        onTogglePreview={() => setShowPreview(v => !v)}
      />

      {/* Toolbar */}
      <Toolbar
        onAction={handleToolbarAction}
        showEditor={showEditor}
        showPreview={showPreview}
        onToggleEditor={() => setShowEditor(v => !v)}
        onTogglePreview={() => setShowPreview(v => !v)}
      />

      {/* Main editor area */}
      <main id="editor-main" className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {showEditor && showPreview ? (
          <PanelGroup direction="horizontal" className="h-full">
            {/* Editor panel */}
            <Panel defaultSize={50} minSize={20}>
              <div className="h-full flex flex-col">
                <div
                  className="px-3 py-1 border-b text-xs select-none"
                  style={{
                    background: 'var(--editor-line-bg)',
                    borderColor: 'var(--border)',
                    color: 'var(--editor-line-numbers)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  EDITOR
                </div>
                <div className="flex-1 overflow-hidden">
                  <EditorPane
                    content={content}
                    onChange={handleContentChange}
                    onCursorChange={(l, c) => setCursorPos({ line: l, col: c })}
                    onInsert={fn => { insertRef.current = fn; }}
                  />
                </div>
              </div>
            </Panel>

            {/* Resize handle */}
            <PanelResizeHandle
              className="w-1 relative transition-colors"
              style={{ background: 'var(--border)' }}
            >
              <div
                aria-hidden="true"
                className="absolute inset-y-0 -left-1 -right-1"
                onMouseEnter={e => ((e.currentTarget.parentElement as HTMLElement).style.background = 'var(--primary)')}
                onMouseLeave={e => ((e.currentTarget.parentElement as HTMLElement).style.background = 'var(--border)')}
              />
            </PanelResizeHandle>

            {/* Preview panel */}
            <Panel defaultSize={50} minSize={20}>
              <div className="h-full flex flex-col">
                <div
                  className="px-3 py-1 border-b text-xs select-none"
                  style={{
                    background: 'var(--preview-bg)',
                    borderColor: 'var(--border)',
                    color: 'var(--muted-foreground)',
                  }}
                >
                  PREVIEW
                </div>
                <div className="flex-1 overflow-hidden">
                  <PreviewPane
                    ref={previewRef}
                    content={content}
                    isDark={isDark}
                  />
                </div>
              </div>
            </Panel>
          </PanelGroup>
        ) : showEditor ? (
          /* Editor only */
          <div className="h-full flex flex-col">
            <div
              className="px-3 py-1 border-b text-xs select-none"
              style={{ background: 'var(--editor-line-bg)', borderColor: 'var(--border)', color: 'var(--editor-line-numbers)', fontFamily: 'var(--font-mono)' }}
            >
              EDITOR
            </div>
            <div className="flex-1 overflow-hidden">
              <EditorPane
                content={content}
                onChange={handleContentChange}
                onCursorChange={(l, c) => setCursorPos({ line: l, col: c })}
                onInsert={fn => { insertRef.current = fn; }}
              />
            </div>
          </div>
        ) : showPreview ? (
          /* Preview only */
          <div className="h-full overflow-hidden">
            <PreviewPane
              ref={previewRef}
              content={content}
              isDark={isDark}
            />
          </div>
        ) : (
          /* Both hidden */
          <div className="h-full flex items-center justify-center" style={{ color: 'var(--muted-foreground)' }}>
            Use View menu to show Editor or Preview.
          </div>
        )}
      </main>

      {/* Status bar */}
      <StatusBar
        line={cursorPos.line}
        col={cursorPos.col}
        wordCount={wordCount}
        charCount={charCount}
        fileName={fileName}
        isDirty={isDirty}
        theme={theme}
        onThemeChange={setTheme}
        isGoogleSignedIn={!!googleToken}
        googleUserName={googleUser?.name}
      />

      {/* Google Drive dialog */}
      <GoogleDriveDialog
        open={!!driveDialog}
        mode={driveDialog || 'open'}
        fileName={fileName}
        onClose={() => setDriveDialog(false)}
        onFileOpen={handleDriveFileOpen}
        onFileSave={handleDriveFileSave}
        token={googleToken}
        onTokenChange={handleTokenChange}
      />

      {/* Toast notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--card)',
            color: 'var(--card-foreground)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            fontSize: '13px',
          },
        }}
      />
    </div>
  );
}
