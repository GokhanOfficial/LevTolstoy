import { create } from 'zustand'

type Theme = 'dark' | 'light' | 'system'
type Language = 'tr' | 'en'
export type ActiveTab = 'converter' | 'editor'

interface UIStore {
  theme: Theme
  language: Language
  previewOpen: boolean
  previewTaskId: string | null
  activeTab: ActiveTab
  editorContent: string
  editorTitle: string
  setTheme: (t: Theme) => void
  setLanguage: (l: Language) => void
  openPreview: (taskId: string) => void
  closePreview: () => void
  setActiveTab: (tab: ActiveTab) => void
  openInEditor: (markdown: string, title?: string) => void
}

export const useUIStore = create<UIStore>((set) => ({
  theme: (localStorage.getItem('theme') as Theme) || 'system',
  language: (localStorage.getItem('language') as Language) || 'tr',
  previewOpen: false,
  previewTaskId: null,
  activeTab: 'converter',
  editorContent: '',
  editorTitle: 'belge.md',

  setTheme: (t) => {
    localStorage.setItem('theme', t)
    set({ theme: t })
    applyTheme(t)
  },

  setLanguage: (l) => {
    localStorage.setItem('language', l)
    set({ language: l })
  },

  openPreview: (taskId) => set({ previewOpen: true, previewTaskId: taskId }),
  closePreview: () => set({ previewOpen: false, previewTaskId: null }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  openInEditor: (markdown, title = 'belge.md') =>
    set({ editorContent: markdown, editorTitle: title, activeTab: 'editor' }),
}))

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.add(prefersDark ? 'dark' : 'light')
  } else {
    root.classList.add(theme)
  }
}

applyTheme((localStorage.getItem('theme') as Theme) || 'system')

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const stored = localStorage.getItem('theme') as Theme
  if (stored === 'system') applyTheme('system')
})
