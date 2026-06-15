import { X, Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import type { ClientTask } from '@/stores/taskStore'
import { useTaskStore } from '@/stores/taskStore'
import { cn } from '@/lib/utils'

interface Props {
  task: ClientTask
}

const PHASE_LABELS: Record<string, string> = {
  loading:          'Dosya okunuyor...',
  preparing:        'Hazırlanıyor...',
  'media-encoding': 'Medya encode ediliyor...',
  'ai-conversion':  'AI dönüştürüyor...',
  rendering:        'Çıktı oluşturuluyor...',
  summarizing:      'Özetleniyor...',
  completed:        'Tamamlandı',
  failed:           'Hata oluştu',
  cancelled:        'İptal edildi',
}

export default function TaskCard({ task }: Props) {
  const { cancelTask } = useTaskStore()

  const isActive    = task.status === 'processing'
  const isQueued    = task.status === 'queued'
  const isFailed    = task.status === 'failed'
  const isCancelled = task.status === 'cancelled'

  const phaseLabel = PHASE_LABELS[task.phase] ?? task.message ?? task.phase ?? ''

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border bg-card transition-all duration-300',
        isActive
          ? 'border-indigo-500/40 shadow-lg shadow-indigo-500/10'
          : isQueued
          ? 'border-border opacity-80'
          : isFailed
          ? 'border-destructive/40'
          : 'border-border'
      )}
    >
      {/* Animated top bar for active tasks */}
      {isActive && (
        <div className="absolute top-0 left-0 h-[2px] w-full overflow-hidden bg-muted">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
            style={{ width: `${task.progress}%` }}
          />
        </div>
      )}

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {isActive ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-indigo-500" />
            ) : isQueued ? (
              <Clock className="size-4 shrink-0 text-amber-500" />
            ) : isFailed ? (
              <AlertCircle className="size-4 shrink-0 text-destructive" />
            ) : isCancelled ? (
              <X className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <CheckCircle className="size-4 shrink-0 text-emerald-500" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground leading-tight">
                {task.filename ?? task.id.slice(0, 16) + '…'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">
                {task.type === 'summarize' ? '✦ Özetleme' : '⟳ Dönüştürme'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isQueued && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-500">
                KUYRUKTA
              </span>
            )}
            {isActive && (
              <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-500">
                İŞLENİYOR
              </span>
            )}
            {isFailed && (
              <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                HATA
              </span>
            )}
            {isCancelled && (
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                İPTAL
              </span>
            )}
          </div>
        </div>

        {/* Progress bar — active tasks */}
        {(isActive || isQueued) && (
          <div className="mb-2 space-y-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              {isActive ? (
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${task.progress}%` }}
                />
              ) : (
                /* Queued: pulse placeholder */
                <div className="h-full w-1/3 animate-pulse rounded-full bg-muted-foreground/20" />
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{phaseLabel}</span>
              {isActive && (
                <span className="tabular-nums font-medium text-foreground">
                  {task.progress}%
                </span>
              )}
            </div>
          </div>
        )}

        {/* Error message */}
        {isFailed && task.error && (
          <p className="mt-1 mb-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {task.error}
          </p>
        )}

        {/* Cancel button */}
        {(isActive || isQueued) && (
          <button
            onClick={() => cancelTask(task.id)}
            className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-xs text-muted-foreground hover:border-destructive/40 hover:text-destructive hover:bg-destructive/5 transition-all"
          >
            <X className="size-3.5" /> İptal et
          </button>
        )}
      </div>
    </div>
  )
}
