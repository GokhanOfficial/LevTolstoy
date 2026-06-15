import { X, Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import type { ClientTask } from '@/stores/taskStore'
import { useTaskStore } from '@/stores/taskStore'
import { cn } from '@/lib/utils'

interface Props {
  task: ClientTask
}

const PHASE_LABELS: Record<string, string> = {
  loading:       'Dosya okunuyor...',
  preparing:     'Hazırlanıyor...',
  'media-encoding': 'Medya encode ediliyor...',
  'ai-conversion': 'AI dönüştürüyor...',
  rendering:     'Çıktı oluşturuluyor...',
  summarizing:   'Özetleniyor...',
  completed:     'Tamamlandı',
  failed:        'Hata oluştu',
  cancelled:     'İptal edildi',
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
          ? 'border-slate-700 opacity-80'
          : isFailed
          ? 'border-red-500/40'
          : 'border-slate-700'
      )}
    >
      {/* Animated top bar for active tasks */}
      {isActive && (
        <div className="absolute top-0 left-0 h-[2px] w-full overflow-hidden bg-slate-800">
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
              <Loader2 className="size-4 shrink-0 animate-spin text-indigo-400" />
            ) : isQueued ? (
              <Clock className="size-4 shrink-0 text-amber-400" />
            ) : isFailed ? (
              <AlertCircle className="size-4 shrink-0 text-red-400" />
            ) : isCancelled ? (
              <X className="size-4 shrink-0 text-slate-500" />
            ) : (
              <CheckCircle className="size-4 shrink-0 text-emerald-400" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-200 leading-tight">
                {task.filename ?? task.id.slice(0, 16) + '…'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 capitalize">
                {task.type === 'summarize' ? '✦ Özetleme' : '⟳ Dönüştürme'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isQueued && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                KUYRUKTA
              </span>
            )}
            {isActive && (
              <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-400">
                İŞLENİYOR
              </span>
            )}
            {isFailed && (
              <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                HATA
              </span>
            )}
            {isCancelled && (
              <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                İPTAL
              </span>
            )}
          </div>
        </div>

        {/* Progress bar — active tasks */}
        {(isActive || isQueued) && (
          <div className="mb-2 space-y-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              {isActive ? (
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${task.progress}%` }}
                />
              ) : (
                /* Queued: pulse placeholder */
                <div className="h-full w-1/3 animate-pulse rounded-full bg-slate-700" />
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>{phaseLabel}</span>
              {isActive && (
                <span className="tabular-nums font-medium text-slate-400">
                  {task.progress}%
                </span>
              )}
            </div>
          </div>
        )}

        {/* Error message */}
        {isFailed && task.error && (
          <p className="mt-1 mb-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {task.error}
          </p>
        )}

        {/* Cancel button */}
        {(isActive || isQueued) && (
          <button
            onClick={() => cancelTask(task.id)}
            className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 py-1.5 text-xs text-slate-500 hover:border-red-500/40 hover:text-red-400 hover:bg-red-400/5 transition-all"
          >
            <X className="size-3.5" /> İptal et
          </button>
        )}
      </div>
    </div>
  )
}
