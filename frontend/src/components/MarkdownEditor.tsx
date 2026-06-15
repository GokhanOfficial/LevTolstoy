import { useState, useRef, useCallback, useEffect, useMemo, useReducer } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import {
  Bold, Italic, Strikethrough, Code, Link2, Image as ImageIcon,
  List, ListOrdered, Quote, Minus, Table2,
  Download, Copy, Save, Eye, EyeOff, SplitSquareHorizontal,
} from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useHistoryStore } from '@/stores/historyStore'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { marked } from 'marked'

// ── Download helpers ──────────────────────────────────────────────────────────
function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function printAsPdf(markdown: string, title: string) {
  const html = marked.parse(markdown, { breaks: true, gfm: true }) as string
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) { toast.error('Açılır pencerelere izin verin'); return }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:800px;margin:2cm auto;color:#111;line-height:1.7;font-size:13pt}
  h1{font-size:2em;border-bottom:2px solid #6366f1;padding-bottom:.3em;margin-bottom:.6em}
  h2{font-size:1.5em;margin:1.4em 0 .5em}h3{font-size:1.2em}
  p{margin:.7em 0}
  code{background:#f0f0f0;padding:.1em .4em;border-radius:3px;font-size:.9em;font-family:monospace}
  pre{background:#1e1e1e;color:#d4d4d4;padding:1em 1.2em;border-radius:6px;overflow-x:auto;margin:1em 0;page-break-inside:avoid}
  pre code{background:none;padding:0}
  blockquote{border-left:4px solid #6366f1;margin:0;padding:.5em 1em;color:#555;background:#f8f8ff}
  table{border-collapse:collapse;width:100%;margin:1em 0}
  th,td{border:1px solid #ddd;padding:.5em 1em;text-align:left}th{background:#f5f5f5;font-weight:600}
  ul,ol{margin:.5em 0;padding-left:1.5em}li{margin:.2em 0}
  a{color:#6366f1}img{max-width:100%;border-radius:4px}
  @media print{body{margin:0}@page{margin:2cm}}
</style></head><body>${html}</body></html>`)
  w.document.close(); w.focus()
  setTimeout(() => { w.print(); w.close() }, 300)
}

// ── Toolbar ───────────────────────────────────────────────────────────────────
type InsertFn = (wrap: string, placeholder?: string, linePrefix?: string) => void

interface ToolbarItem {
  icon: React.ReactNode
  label: string
  action: (i: InsertFn) => void
  sep?: boolean
}

const TOOLBAR: ToolbarItem[] = [
  { icon: <Bold className="size-3.5" />,          label: 'Kalın',        action: (i) => i('**', 'kalın metin') },
  { icon: <Italic className="size-3.5" />,        label: 'İtalik',       action: (i) => i('*', 'italik metin') },
  { icon: <Strikethrough className="size-3.5" />, label: 'Üstü çizili',  action: (i) => i('~~', 'metin'), sep: true },
  { icon: <Code className="size-3.5" />,          label: 'Satır içi kod', action: (i) => i('`', 'kod') },
  { icon: <Quote className="size-3.5" />,         label: 'Alıntı',       action: (i) => i('', 'alıntı', '> '), sep: true },
  { icon: <Link2 className="size-3.5" />,         label: 'Bağlantı',     action: (i) => i('[', 'bağlantı metni](https://)') },
  { icon: <ImageIcon className="size-3.5" />,     label: 'Resim',        action: (i) => i('![', 'alt](https://)'), sep: true },
  { icon: <List className="size-3.5" />,          label: 'Liste',        action: (i) => i('', 'madde', '- ') },
  { icon: <ListOrdered className="size-3.5" />,   label: 'Sıralı liste', action: (i) => i('', 'madde', '1. ') },
  { icon: <Minus className="size-3.5" />,         label: 'Yatay çizgi',  action: (i) => i('', '\n\n---\n\n') },
  { icon: <Table2 className="size-3.5" />,        label: 'Tablo',        action: (i) => i('', '\n| Başlık 1 | Başlık 2 |\n|----------|----------|\n| Hücre 1  | Hücre 2  |\n') },
]

// ── Editor state ──────────────────────────────────────────────────────────────
interface EditorState {
  content: string
  title: string
}
type EditorAction =
  | { type: 'SET_CONTENT'; content: string }
  | { type: 'SET_TITLE';   title: string }
  | { type: 'LOAD';        content: string; title: string }

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_CONTENT': return { ...state, content: action.content }
    case 'SET_TITLE':   return { ...state, title: action.title }
    case 'LOAD':        return { content: action.content, title: action.title }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MarkdownEditor() {
  const { editorContent, editorTitle, setActiveTab } = useUIStore()
  const { addEntry } = useHistoryStore()

  const [{ content, title }, dispatch] = useReducer(editorReducer, {
    content: editorContent || '# Başlık\n\nBuraya yazmaya başlayın…',
    title:   editorTitle  || 'belge.md',
  })

  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split')
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumsRef = useRef<HTMLDivElement>(null)

  // Sync when opened from outside (ResultCard / HistoryPanel)
  useEffect(() => {
    if (editorContent) {
      dispatch({ type: 'LOAD', content: editorContent, title: editorTitle || 'belge.md' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorContent, editorTitle])

  const lineCount = useMemo(() => content.split('\n').length, [content])

  const syncScroll = useCallback(() => {
    if (textareaRef.current && lineNumsRef.current) {
      lineNumsRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }, [])

  const updateCursor = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    const text = el.value.substring(0, el.selectionStart)
    const lines = text.split('\n')
    setCursorPos({ line: lines.length, col: lines[lines.length - 1].length + 1 })
  }, [])

  const insertText: InsertFn = useCallback((wrap, placeholder = '', linePrefix = '') => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = el.value.substring(start, end) || placeholder
    const before = el.value.substring(0, start)
    const after = el.value.substring(end)
    const newContent = linePrefix
      ? `${before}\n${linePrefix}${selected}\n${after}`
      : `${before}${wrap}${selected}${wrap}${after}`
    dispatch({ type: 'SET_CONTENT', content: newContent })
    setTimeout(() => {
      el.focus()
      const cursor = linePrefix
        ? start + linePrefix.length + selected.length + 1
        : start + wrap.length + selected.length
      el.setSelectionRange(cursor, cursor)
    }, 0)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const el = e.currentTarget
      const start = el.selectionStart
      const newContent = el.value.substring(0, start) + '  ' + el.value.substring(el.selectionEnd)
      dispatch({ type: 'SET_CONTENT', content: newContent })
      setTimeout(() => el.setSelectionRange(start + 2, start + 2), 0)
    }
  }, [])

  const baseName = title.replace(/\.(md|html|txt)$/i, '')

  const proseClasses = cn(
    'prose max-w-none',
    'prose-headings:text-slate-100 prose-headings:font-semibold',
    'prose-p:text-slate-300 prose-p:leading-relaxed',
    'prose-strong:text-slate-200 prose-em:text-slate-300',
    'prose-code:text-indigo-300 prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-normal',
    'prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800',
    'prose-blockquote:border-indigo-500 prose-blockquote:text-slate-400 prose-blockquote:not-italic',
    'prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline',
    'prose-hr:border-slate-800',
    'prose-li:text-slate-300 prose-li:marker:text-slate-600',
    'prose-table:text-slate-300',
    'prose-th:text-slate-200 prose-th:border-slate-700 prose-th:bg-slate-900',
    'prose-td:border-slate-700',
    'prose-img:rounded-xl'
  )

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col bg-slate-950">

      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-800 bg-slate-900/80 px-3 py-2">
        {/* File name */}
        <input
          value={title}
          onChange={(e) => dispatch({ type: 'SET_TITLE', title: e.target.value })}
          className="mr-2 w-40 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 outline-none focus:border-indigo-500/60"
          placeholder="dosyaadı.md"
        />

        {/* Format actions */}
        {TOOLBAR.map((item, i) => (
          <span key={i} className="flex items-center">
            {item.sep && <span className="mx-1 h-4 w-px bg-slate-700" />}
            <button
              onClick={() => item.action(insertText)}
              title={item.label}
              className="flex h-7 w-7 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
            >
              {item.icon}
            </button>
          </span>
        ))}

        <span className="mx-1 h-4 w-px bg-slate-700" />

        {/* View toggles */}
        {([
          { mode: 'edit' as const,    icon: <EyeOff className="size-3.5" />,               title: 'Sadece editör' },
          { mode: 'split' as const,   icon: <SplitSquareHorizontal className="size-3.5" />, title: 'Bölünmüş' },
          { mode: 'preview' as const, icon: <Eye className="size-3.5" />,                   title: 'Önizleme' },
        ]).map(({ mode, icon, title: t }) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            title={t}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded transition-colors',
              viewMode === mode
                ? 'bg-indigo-600 text-white'
                : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
            )}
          >
            {icon}
          </button>
        ))}

        <span className="mx-1 h-4 w-px bg-slate-700" />

        {/* Save/copy */}
        <button
          onClick={() => { addEntry({ title, markdown: content, source: 'editor' }); toast.success('Geçmişe kaydedildi') }}
          className="flex h-7 items-center gap-1.5 rounded px-2 text-xs text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
        >
          <Save className="size-3.5" /> Kaydet
        </button>
        <button
          onClick={async () => { await navigator.clipboard.writeText(content); toast.success('Kopyalandı') }}
          className="flex h-7 items-center gap-1.5 rounded px-2 text-xs text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
        >
          <Copy className="size-3.5" /> Kopyala
        </button>

        {/* Download buttons */}
        <button onClick={() => downloadBlob(content, `${baseName}.md`, 'text/markdown')}
          className="flex h-7 items-center gap-1.5 rounded border border-sky-500/30 bg-sky-500/10 px-2 text-xs font-medium text-sky-400 transition-colors hover:bg-sky-500/20">
          <Download className="size-3.5" /> MD
        </button>
        <button onClick={() => {
            const html = marked.parse(content, { gfm: true, breaks: true }) as string
            downloadBlob(`<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:system-ui;max-width:800px;margin:2em auto;line-height:1.6">${html}</body></html>`, `${baseName}.html`, 'text/html')
          }}
          className="flex h-7 items-center gap-1.5 rounded border border-orange-500/30 bg-orange-500/10 px-2 text-xs font-medium text-orange-400 transition-colors hover:bg-orange-500/20">
          <Download className="size-3.5" /> HTML
        </button>
        <button onClick={() => printAsPdf(content, baseName)}
          className="flex h-7 items-center gap-1.5 rounded border border-red-500/30 bg-red-500/10 px-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20">
          <Download className="size-3.5" /> PDF
        </button>
      </div>

      {/* ── Panes ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Editor */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className={cn(
            'flex flex-col overflow-hidden border-r border-slate-800',
            viewMode === 'split' ? 'w-1/2' : 'w-full'
          )}>
            <div className="flex flex-1 overflow-hidden font-mono text-sm">
              {/* Line numbers */}
              <div
                ref={lineNumsRef}
                className="select-none overflow-hidden border-r border-slate-800 bg-slate-900/50 px-3 pt-4 text-right text-xs leading-6 text-slate-700"
                style={{ minWidth: '3rem' }}
              >
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i + 1}>{i + 1}</div>
                ))}
              </div>
              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => dispatch({ type: 'SET_CONTENT', content: e.target.value })}
                onKeyDown={handleKeyDown}
                onScroll={syncScroll}
                onSelect={updateCursor}
                onClick={updateCursor}
                spellCheck={false}
                className="flex-1 resize-none bg-slate-950 px-4 pt-4 pb-16 text-slate-200 outline-none leading-6 placeholder:text-slate-700"
                placeholder="Markdown yazın…"
              />
            </div>
          </div>
        )}

        {/* Preview */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={cn(
            'flex-1 overflow-y-auto bg-slate-950 px-8 py-6',
            viewMode === 'split' ? 'w-1/2' : 'w-full'
          )}>
            <div className={cn('mx-auto max-w-3xl', proseClasses)}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                {content}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {/* ── Status bar ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 border-t border-slate-800 bg-slate-900/60 px-4 py-1.5 text-[11px] text-slate-600">
        <span>Satır {cursorPos.line}, Sütun {cursorPos.col}</span>
        <span>·</span>
        <span>{lineCount} satır</span>
        <span>·</span>
        <span>{content.length} karakter</span>
        <span>·</span>
        <span>{content.trim().split(/\s+/).filter(Boolean).length} kelime</span>
        <div className="ml-auto">
          <button
            onClick={() => setActiveTab('converter')}
            className="text-slate-600 transition-colors hover:text-slate-400"
          >
            ← Dönüştürücüye dön
          </button>
        </div>
      </div>
    </div>
  )
}
