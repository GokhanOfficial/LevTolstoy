export const api = {
  createTask: async (formData: FormData) => {
    const res = await fetch('/api/v2/tasks', {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) throw new Error('Failed to create task')
    return res.json()
  },

  createTaskFromText: async (content: string, filename: string, type: string, model: string) => {
    const res = await fetch('/api/v2/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, filename, type, model, outputFormat: 'markdown', mergeMode: 'separate' }),
    })
    if (!res.ok) throw new Error('Failed to create task')
    return res.json()
  },

  getTasks: async () => {
    const res = await fetch('/api/v2/tasks')
    if (!res.ok) throw new Error('Failed to fetch tasks')
    return res.json()
  },

  getTask: async (id: string) => {
    const res = await fetch(`/api/v2/tasks/${id}`)
    if (!res.ok) throw new Error('Failed to fetch task')
    return res.json()
  },

  cancelTask: async (id: string) => {
    const res = await fetch(`/api/v2/tasks/${id}/cancel`, { method: 'POST' })
    if (!res.ok) throw new Error('Failed to cancel task')
    return res.json()
  },

  downloadTask: (id: string, format: 'pdf' | 'html' | 'md') => {
    window.open(`/api/v2/tasks/${id}/download?format=${format}`, '_blank')
  },
}
