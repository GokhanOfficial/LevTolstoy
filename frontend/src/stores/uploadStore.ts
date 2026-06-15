import { create } from 'zustand'

export type Mode = 'convert' | 'summarize'
export type MergeMode = 'separate' | 'single'

interface Options {
  mode: Mode
  mergeMode: MergeMode
  model: string
}

interface UploadStore {
  files: File[]
  options: Options
  addFiles: (files: FileList | File[]) => void
  removeFile: (idx: number) => void
  clearFiles: () => void
  setOption: <K extends keyof Options>(k: K, v: Options[K]) => void
  reset: () => void
}

const defaultOptions: Options = {
  mode: 'convert',
  mergeMode: 'separate',
  model: 'gemini-3.5-flash',
}

export const useUploadStore = create<UploadStore>((set) => ({
  files: [],
  options: { ...defaultOptions },

  addFiles: (files) =>
    set((state) => ({
      files: [...state.files, ...Array.from(files)],
    })),

  removeFile: (idx) =>
    set((state) => ({
      files: state.files.filter((_, i) => i !== idx),
    })),

  clearFiles: () => set({ files: [] }),

  setOption: (k, v) =>
    set((state) => ({
      options: { ...state.options, [k]: v },
    })),

  reset: () => set({ files: [], options: { ...defaultOptions } }),
}))
