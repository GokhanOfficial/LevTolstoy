import { useEffect, useReducer } from 'react'
import { X, Download, ExternalLink } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useTaskStore } from '@/stores/taskStore'
import { api } from '@/lib/api'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { cn } from '@/lib/utils'

interface State {
  loading: boolean
  content: string | null
}

type Action =
  | { type: 'LOADING' }
  | { type: 'LOADED'; content: string | null }

function reducer(_state: State, action: Action): State {
  if (action.type === 'LOADING') return { loading: true, content: null }
  return { loading: false, content: action.content }
}

export default function PreviewDrawer() {
  const { previewOpen, previewTaskId, closePreview } = useUIStore()
  const { tasks } = useTaskStore()
  const [state, dispatch] = useReducer(reducer, { loading: false, content: null })

  const task = tasks.find((t) => t.id === previewTaskId)
  const filename = task?.filename ?? previewTaskId?.slice(0, 16)

  useEffect(() => {
    if (!previewOpen || !previewTaskId) return
    let cancelled = false

    dispatch({ type: 'LOADING' })

    api
      .getTask(previewTaskId)
      .then((data) => {
        if (!cancelled) dispatch({ type: 'LOADED', content: data.markdown ?? data.html ?? '' })
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'LOADED', content: null })
      })

    return () => { cancelled = true }
  }, [previewOpen, previewTaskId])

  if (!previewOpen) return null

  const renderedHtml =
    state.content
      ? DOMPurify.sanitize(marked.parse(state.content, { breaks: true, gfm: true }) as string)
      : null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
        onClick={closePreview}
      />

      {/* Drawer panel */}
      <div className="fixed inset-y-0 right-0 z-[101] flex w-full max-w-2xl flex-col bg-card shadow-2xl border-l border-border transition-colors duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{filename}</p>
            <p className="text-xs text-muted-foreground">Önizleme</p>
          </div>
          <div className="flex items-center gap-2 ml-4 shrink-0">
            {previewTaskId && (
              <>
                <button
                  onClick={() => api.downloadTask(previewTaskId, 'md')}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-indigo-500/50 hover:text-indigo-500 transition-colors"
                >
                  <Download className="size-3.5" /> MD
                </button>
                <button
                  onClick={() =>
                    window.open(
                      `/api/v2/tasks/${previewTaskId}/download?format=pdf`,
                      '_blank'
                    )
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-red-500/50 hover:text-red-500 transition-colors"
                >
                  <ExternalLink className="size-3.5" /> PDF
                </button>
              </>
            )}
            <button
              onClick={closePreview}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Kapat"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {state.loading && (
            <div className="flex items-center justify-center h-full">
              <div className="space-y-3 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                <p className="text-sm text-muted-foreground">Yükleniyor...</p>
              </div>
            </div>
          )}

          {!state.loading && !state.content && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">İçerik yüklenemedi.</p>
            </div>
          )}

          {!state.loading && renderedHtml && (
            <div
              className={cn('prose max-w-none')}
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          )}
        </div>
      </div>
    </>
  )
}
