import { useState } from 'react'
import { Copy, Trash2, Eye, FileDown, Edit3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ClientTask } from '@/stores/taskStore'
import { useTaskStore } from '@/stores/taskStore'
import { useUIStore } from '@/stores/uiStore'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Props {
  task: ClientTask
}

const FORMAT_META = {
  pdf:  { label: 'PDF',  color: 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20' },
  html: { label: 'HTML', color: 'border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20' },
  md:   { label: 'MD',   color: 'border-sky-500/30 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20' },
}

export default function ResultCard({ task }: Props) {
  const { removeTask } = useTaskStore()
  const { openPreview, openInEditor } = useUIStore()
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)

  const handleCopy = async () => {
    try {
      const data = await api.getTask(task.id)
      if (data.markdown) {
        await navigator.clipboard.writeText(data.markdown)
        setCopied(true)
        toast.success('Kopyalandı!')
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      toast.error('Kopyalama başarısız.')
    }
  }

  const handleOpenInEditor = async () => {
    try {
      const data = await api.getTask(task.id)
      if (data.markdown) {
        openInEditor(data.markdown, task.filename ?? 'belge.md')
      }
    } catch {
      toast.error('Editörde açılamadı.')
    }
  }

  const handleDownload = (format: 'pdf' | 'html' | 'md') => {
    setDownloading(format)
    try {
      api.downloadTask(task.id, format)
    } finally {
      setTimeout(() => setDownloading(null), 1000)
    }
  }

  const handleDelete = () => {
    removeTask(task.id)
    toast.success('Silindi.')
  }

  const isCompleted = task.status === 'completed'

  return (
    <Card className="group overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm truncate leading-snug">
              {task.filename ?? task.id.slice(0, 8)}
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground capitalize">
              {task.type === 'summarize' ? '✦ Özet' : '⟳ Dönüştürme'}
            </p>
          </div>
          <button
            onClick={handleDelete}
            className="shrink-0 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Download format buttons */}
        {isCompleted && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              İndir
            </p>
            <div className="flex gap-1.5">
              {(['pdf', 'html', 'md'] as const).map((fmt) => {
                const meta = FORMAT_META[fmt]
                return (
                  <button
                    key={fmt}
                    onClick={() => handleDownload(fmt)}
                    disabled={downloading === fmt}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-semibold transition-all',
                      meta.color,
                      downloading === fmt && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <FileDown className="size-3.5" />
                    {downloading === fmt ? '…' : meta.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Error / cancelled */}
        {task.status === 'failed' && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {task.error ?? 'İşlem başarısız oldu.'}
          </div>
        )}

        {/* Action row */}
        <div className="flex gap-1.5">
          <button
            onClick={handleCopy}
            disabled={!isCompleted}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 py-1.5 text-xs text-slate-500 transition-colors hover:border-slate-600 hover:text-slate-300 disabled:opacity-40"
          >
            <Copy className="size-3.5" />
            {copied ? 'Kopyalandı!' : 'Kopyala'}
          </button>
          <button
            onClick={() => openPreview(task.id)}
            disabled={!isCompleted}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 py-1.5 text-xs text-slate-500 transition-colors hover:border-slate-600 hover:text-slate-300 disabled:opacity-40"
          >
            <Eye className="size-3.5" />
            Önizle
          </button>
          <button
            onClick={handleOpenInEditor}
            disabled={!isCompleted}
            title="Editörde düzenle"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 py-1.5 text-xs text-slate-500 transition-colors hover:border-indigo-500/50 hover:text-indigo-400 disabled:opacity-40"
          >
            <Edit3 className="size-3.5" />
            Düzenle
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
