import { useEffect } from 'react'
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
import i18n from '@/i18n'

const TABS = [
  { key: 'converter' as const, label: 'Dönüştürücü' },
  { key: 'editor'    as const, label: 'MD Editörü'  },
]

export default function App() {
  const { language, activeTab, setActiveTab } = useUIStore()
  const { startPolling, refresh } = useTaskStore()

  useEffect(() => {
    i18n.changeLanguage(language)
  }, [language])

  useEffect(() => {
    refresh()
    startPolling()
    return () => {
      useTaskStore.getState().stopPolling()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />

      {/* ── Tab bar ── */}
      <div className="sticky top-14 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl gap-0 px-4">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'relative px-5 py-3 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'text-slate-100'
                  : 'text-slate-500 hover:text-slate-300'
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
            <h2 className="text-2xl font-bold tracking-tight text-slate-100">
              Dosyalarınızı dönüştürün
            </h2>
            <p className="text-sm text-slate-500">
              PDF, DOCX, resim, ses ve daha fazlasını&nbsp;
              <span className="text-indigo-400">Markdown</span>'a çevirin veya özetleyin
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
