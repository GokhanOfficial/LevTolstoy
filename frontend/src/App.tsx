import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Toaster } from '@/components/ui/sonner'
import Header from '@/components/Header'
import UploadSection from '@/components/UploadSection'
import TaskQueue from '@/components/TaskQueue'
import CompletedTasks from '@/components/CompletedTasks'
import HistoryPanel from '@/components/HistoryPanel'
import PreviewDrawer from '@/components/PreviewDrawer'
import MarkdownEditor from '@/components/MarkdownEditor'
import { useTaskStore } from '@/stores/taskStore'
import { useUIStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'

export default function App() {
  const { t } = useTranslation('common')
  const { activeTab, setActiveTab } = useUIStore()
  const { startPolling, refresh } = useTaskStore()

  useEffect(() => {
    refresh()
    startPolling()
    return () => {
      useTaskStore.getState().stopPolling()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const TABS = [
    { key: 'converter' as const, label: t('converter') },
    { key: 'editor'    as const, label: t('editor')    },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <Header />

      {/* ── Tab bar ── */}
      <div className="sticky top-14 z-40 border-b border-border bg-card/90 backdrop-blur-md transition-colors duration-200">
        <div className="mx-auto flex max-w-2xl gap-0 px-4">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'relative px-5 py-3 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Converter tab ── */}
      {activeTab === 'converter' && (
        <main className="mx-auto max-w-2xl px-4 pb-24 pt-8 space-y-10">
          <div className="space-y-1 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {t('convertFiles')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('convertFilesDesc')}&nbsp;
              <span className="text-indigo-400">Markdown</span>{t('convertFilesDesc2')}
            </p>
          </div>

          <UploadSection />
          <TaskQueue />
          <CompletedTasks />
          <HistoryPanel />
        </main>
      )}

      {/* ── Editor tab ── */}
      {activeTab === 'editor' && <MarkdownEditor />}

      <PreviewDrawer />
      <Toaster />
    </div>
  )
}
