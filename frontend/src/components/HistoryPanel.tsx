import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { History, Trash2, Download, Edit3, ChevronDown, ChevronUp } from 'lucide-react'
import { useHistoryStore, type HistoryEntry } from '@/stores/historyStore'
import { useUIStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { marked } from 'marked'

function formatDate(ts: number) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(ts))
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function printAsPdf(markdown: string, title: string) {
  const html = marked.parse(markdown, { breaks: true, gfm: true }) as string
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) { toast.error('Açılır pencerelere izin verin'); return }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:800px;margin:2cm auto;color:#111;line-height:1.6}
  h1{font-size:2em;border-bottom:2px solid #6366f1;padding-bottom:.3em}
  h2{font-size:1.5em}h3{font-size:1.2em}
  code{background:#f0f0f0;padding:.1em .4em;border-radius:3px;font-size:.9em}
  pre{background:#1e1e1e;color:#d4d4d4;padding:1em;border-radius:5px;overflow-x:auto}
  pre code{background:none;padding:0}
  blockquote{border-left:4px solid #6366f1;margin:0;padding:0 1em;color:#555}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #ddd;padding:.5em 1em}th{background:#f5f5f5}
  @media print{body{margin:0}}
</style></head><body>${html}</body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print(); w.close() }, 300)
}

function HistoryCard({ entry }: { entry: HistoryEntry }) {
  const { removeEntry } = useHistoryStore()
  const { openInEditor } = useUIStore()
  const [expanded, setExpanded] = useState(false)

  const excerpt = entry.markdown.slice(0, 120).replace(/[#*`>\n]/g, ' ').trim()
  const base = entry.title.replace(/\.(md|html|txt)$/i, '')

  return (
    <div className="group rounded-xl border border-border bg-card overflow-hidden transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground leading-tight">{entry.title}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDate(entry.createdAt)}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => openInEditor(entry.markdown, entry.title)}
            title="Editörde düzenle"
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-indigo-500/10 hover:text-indigo-500"
          >
            <Edit3 className="size-3.5" />
          </button>
          <button
            onClick={() => removeEntry(entry.id)}
            title="Sil"
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            title={expanded ? 'Daralt' : 'Genişlet'}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
        </div>
      </div>

      {/* Excerpt (when collapsed) */}
      {!expanded && (
        <p className="px-4 pb-3 text-xs text-muted-foreground leading-relaxed line-clamp-2">{excerpt}</p>
      )}

      {/* Expanded: download buttons */}
      {expanded && (
        <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-2">
          <p className="text-[11px] text-muted-foreground mb-2">İndir:</p>
          <div className="flex gap-2">
            <button
              onClick={() => downloadBlob(entry.markdown, `${base}.md`, 'text/markdown')}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2 py-1.5 text-xs font-semibold text-sky-500 transition-colors hover:bg-sky-500/20"
            >
              <Download className="size-3.5" /> MD
            </button>
            <button
              onClick={() => {
                const html = marked.parse(entry.markdown, { gfm: true, breaks: true }) as string
                downloadBlob(`<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${html}</body></html>`, `${base}.html`, 'text/html')
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-2 py-1.5 text-xs font-semibold text-orange-500 transition-colors hover:bg-orange-500/20"
            >
              <Download className="size-3.5" /> HTML
            </button>
            <button
              onClick={() => printAsPdf(entry.markdown, base)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/20"
            >
              <Download className="size-3.5" /> PDF
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function HistoryPanel() {
  const { t } = useTranslation('common')
  const { entries, clear } = useHistoryStore()
  const [collapsed, setCollapsed] = useState(false)

  if (entries.length === 0) return null

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-foreground/80 transition-colors"
        >
          <History className="size-4 text-muted-foreground" />
          {t('history')}
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {entries.length}
          </span>
          {collapsed ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronUp className="size-3.5 text-muted-foreground" />}
        </button>
        <button
          onClick={clear}
          className="text-xs text-muted-foreground transition-colors hover:text-destructive"
        >
          {t('deleteAll')}
        </button>
      </div>

      {!collapsed && (
        <div className={cn('grid gap-3', entries.length > 1 ? 'sm:grid-cols-2' : '')}>
          {entries.map((entry) => (
            <HistoryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </section>
  )
}
