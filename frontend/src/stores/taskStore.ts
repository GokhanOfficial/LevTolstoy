import { create } from 'zustand'
import { api } from '@/lib/api'
import { useHistoryStore } from '@/stores/historyStore'

export interface ClientTask {
  id: string
  type: 'auto' | 'convert' | 'summarize'
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  phase: string
  message: string
  progress: number
  filename: string | null
  outputFormat: 'pdf' | 'html' | 'markdown'
  aiDecision: 'convert' | 'summarize' | null
  createdAt: number
  error: string | null
}

interface QueueStatus {
  active: number
  queued: number
  max: number
}

interface TaskStore {
  tasks: ClientTask[]
  queueStatus: QueueStatus
  isPolling: boolean
  pollingInterval: number | null
  addOrUpdateTask: (task: ClientTask) => void
  removeTask: (id: string) => void
  setTasks: (tasks: ClientTask[]) => void
  setQueueStatus: (qs: QueueStatus) => void
  startPolling: () => void
  stopPolling: () => void
  cancelTask: (id: string) => Promise<void>
  refresh: () => Promise<void>
}

// Track which tasks have already been saved to history
const savedToHistory = new Set<string>()

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  queueStatus: { active: 0, queued: 0, max: 3 },
  isPolling: false,
  pollingInterval: null,

  addOrUpdateTask: (task) =>
    set((state) => {
      const idx = state.tasks.findIndex((t) => t.id === task.id)
      if (idx >= 0) {
        const next = [...state.tasks]
        next[idx] = { ...next[idx], ...task }
        return { tasks: next }
      }
      return { tasks: [...state.tasks, task] }
    }),

  removeTask: (id) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    })),

  setTasks: (tasks) => set({ tasks }),
  setQueueStatus: (qs) => set({ queueStatus: qs }),

  startPolling: () => {
    const state = get()
    if (state.isPolling) return
    const interval = window.setInterval(() => {
      get().refresh()
    }, 2000)
    set({ isPolling: true, pollingInterval: interval })
  },

  stopPolling: () => {
    const state = get()
    if (state.pollingInterval) {
      clearInterval(state.pollingInterval)
    }
    set({ isPolling: false, pollingInterval: null })
  },

  cancelTask: async (id) => {
    await api.cancelTask(id)
    await get().refresh()
  },

  refresh: async () => {
    try {
      const data = await api.getTasks()
      const tasks: ClientTask[] = data.tasks || []
      get().setTasks(tasks)
      get().setQueueStatus(data.queue || { active: 0, queued: 0, max: 3 })

      // Auto-save newly completed tasks to history
      const justCompleted = tasks.filter(
        (t) => t.status === 'completed' && !savedToHistory.has(t.id)
      )
      for (const task of justCompleted) {
        savedToHistory.add(task.id)
        // Fetch markdown content and save to history
        api.getTask(task.id)
          .then((detail) => {
            if (detail.markdown) {
              useHistoryStore.getState().addEntry({
                title: task.filename || task.id.slice(0, 12),
                markdown: detail.markdown,
                source: 'task',
              })
            }
          })
          .catch(() => {/* silently ignore */})
      }
    } catch {
      // silently fail; user can retry manually
    }
  },
}))
