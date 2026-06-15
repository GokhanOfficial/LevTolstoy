import { create } from 'zustand'

export interface HistoryEntry {
  id: string
  title: string
  markdown: string
  source: 'task' | 'editor' | 'paste'
  createdAt: number
}

const STORAGE_KEY = 'lev-history'
const MAX_ENTRIES = 50

function load(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : []
  } catch {
    return []
  }
}

function save(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // storage full — silently ignore
  }
}

interface HistoryStore {
  entries: HistoryEntry[]
  addEntry: (entry: Omit<HistoryEntry, 'id' | 'createdAt'>) => void
  removeEntry: (id: string) => void
  clear: () => void
}

export const useHistoryStore = create<HistoryStore>((set) => ({
  entries: load(),

  addEntry: (entry) =>
    set((state) => {
      const newEntry: HistoryEntry = {
        ...entry,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      }
      const entries = [newEntry, ...state.entries].slice(0, MAX_ENTRIES)
      save(entries)
      return { entries }
    }),

  removeEntry: (id) =>
    set((state) => {
      const entries = state.entries.filter((e) => e.id !== id)
      save(entries)
      return { entries }
    }),

  clear: () => {
    localStorage.removeItem(STORAGE_KEY)
    return set({ entries: [] })
  },
}))
