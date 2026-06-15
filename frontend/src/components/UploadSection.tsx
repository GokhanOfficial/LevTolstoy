import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Upload, X, FileText, FileImage, FileAudio, FileVideo,
  FileSpreadsheet, Loader2, Sparkles, Settings2, ChevronDown,
  ArrowRight, File, Files, FilePlus2, Clipboard, FileCode,
} from 'lucide-react'
import { useUploadStore } from '@/stores/uploadStore'
import { useTaskStore } from '@/stores/taskStore'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const MODELS = [
  { value: 'gemini-3.5-flash',       label: 'Gemini 3.5 Flash (Önerilen)' },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
  { value: 'gemini-2.5-flash',       label: 'Gemini 2.5 Flash' },
  { value: 'gpt-5.4-mini',           label: 'GPT-5.4 Mini' },
  { value: 'qwen-3.7-max',           label: 'Qwen 3.7 Max' },
]

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function getFileIcon(file: File) {
  const m = file.type
  if (m.startsWith('image/'))      return <FileImage className="size-4 shrink-0 text-sky-500" />
  if (m.startsWith('audio/'))      return <FileAudio className="size-4 shrink-0 text-green-500" />
  if (m.startsWith('video/'))      return <FileVideo className="size-4 shrink-0 text-purple-500" />
  if (m.includes('pdf'))           return <FileText className="size-4 shrink-0 text-red-500" />
  if (m.includes('spreadsheet') || m.includes('excel') || m.includes('csv'))
    return <FileSpreadsheet className="size-4 shrink-0 text-emerald-500" />
  if (m.includes('word') || m.includes('document'))
    return <FileText className="size-4 shrink-0 text-blue-500" />
  return <File className="size-4 shrink-0 text-muted-foreground" />
}

interface UploadProgress {
  loaded: number
  total: number
  rate: number
  pct: number
}

export default function UploadSection() {
  const { t } = useTranslation('upload')
  const { files, options, addFiles, removeFile, clearFiles, setOption } = useUploadStore()
  const { refresh, startPolling } = useTaskStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const mdInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [starting, setStarting] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [renderingMd, setRenderingMd] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
    },
    [addFiles]
  )

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) addFiles(e.target.files)
      e.target.value = ''
    },
    [addFiles]
  )

  // ── MD / HTML file → direct PDF render (no AI) ───────────
  const handleMdFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    try {
      setRenderingMd(true)
      const text = await file.text()
      if (!text.trim()) {
        toast.error('Dosya boş')
        return
      }
      const mime = file.name.endsWith('.html') ? 'text/html' : 'text/markdown'
      const result = await api.createTaskFromText(
        text,
        file.name,
        'convert',
        options.model,
        'pdf',
        mime,
      )
      if (result) {
        await refresh()
        startPolling()
        toast.success(`${file.name} PDF'e dönüştürülüyor`)
      }
    } catch {
      toast.error('Dosya okunamadı veya işlem başlatılamadı.')
    } finally {
      setRenderingMd(false)
    }
  }

  // ── Paste from clipboard ──────────────────────────────────
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text.trim()) {
        toast.error('Pano boş veya metin içermiyor')
        return
      }
      setPasting(true)
      const result = await api.createTaskFromText(
        text,
        'paste.md',
        options.mode,
        options.model
      )
      if (result) {
        await refresh()
        startPolling()
        toast.success('Pano içeriği işleme alındı')
      }
    } catch {
      toast.error('Pano erişilemedi. Tarayıcı iznini kontrol edin.')
    } finally {
      setPasting(false)
    }
  }

  const handleStart = async () => {
    if (!files.length) return
    setStarting(true)
    setUploadProgress({ loaded: 0, total: 0, rate: 0, pct: 0 })

    try {
      const formData = new FormData()
      files.forEach((f) => formData.append('files', f))
      formData.append('type', options.mode)
      formData.append('model', options.model)
      formData.append('outputFormat', 'markdown')
      formData.append('mergeMode', options.mergeMode)

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        let startTime = Date.now()
        let lastLoaded = 0

        xhr.upload.addEventListener('loadstart', () => {
          startTime = Date.now()
          lastLoaded = 0
        })

        xhr.upload.addEventListener('progress', (ev) => {
          if (!ev.lengthComputable) return
          const elapsed = (Date.now() - startTime) / 1000
          const delta = ev.loaded - lastLoaded
          lastLoaded = ev.loaded
          setUploadProgress({
            loaded: ev.loaded,
            total: ev.total,
            rate: elapsed > 0 ? delta / elapsed : 0,
            pct: Math.round((ev.loaded / ev.total) * 100),
          })
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`HTTP ${xhr.status}`))
        })
        xhr.addEventListener('error', () => reject(new Error('Network error')))

        xhr.open('POST', '/api/v2/tasks')
        xhr.send(formData)
      })

      clearFiles()
      await refresh()
      startPolling()
      toast.success(
        files.length > 1 ? `${files.length} dosya işleme alındı` : 'Dosya işleme alındı'
      )
    } catch {
      toast.error('İşlem başlatılamadı. Tekrar deneyin.')
    } finally {
      setStarting(false)
      setUploadProgress(null)
    }
  }

  const totalSize = files.reduce((a, f) => a + f.size, 0)
  const hasFiles = files.length > 0

  return (
    <div className="w-full space-y-3">

      {/* ── Drop Zone ── */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        aria-label="Dosya yükle"
        className={cn(
          'relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all duration-200 select-none',
          dragging
            ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
            : 'border-border bg-muted/30 hover:border-indigo-500/50 hover:bg-muted/50'
        )}
      >
        <div className={cn(
          'flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-200',
          dragging ? 'bg-indigo-500/20 scale-110' : 'bg-muted'
        )}>
          <Upload className={cn('size-6 transition-colors', dragging ? 'text-indigo-500' : 'text-muted-foreground')} />
        </div>

        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {dragging ? t('dropZoneDrop') : t('dropZoneTitle')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('dropZoneDesc')}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-1.5">
          {['PDF', 'DOCX', 'PPTX', 'XLSX', 'JPG/PNG', 'MP3', 'MP4', 'MD', 'HTML'].map((fmt) => (
            <span
              key={fmt}
              className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              {fmt}
            </span>
          ))}
        </div>

        <input ref={inputRef} type="file" multiple className="hidden" onChange={handleInput} />
      </div>

      {/* ── Quick-action row: MD/HTML upload + Paste ── */}
      <div className="grid grid-cols-2 gap-2">
        {/* MD / HTML → direct PDF */}
        <button
          onClick={() => mdInputRef.current?.click()}
          disabled={renderingMd}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background py-2.5 text-sm text-muted-foreground transition-colors hover:border-purple-500/40 hover:bg-purple-500/5 hover:text-purple-500 disabled:opacity-50"
        >
          {renderingMd
            ? <><Loader2 className="size-4 animate-spin" /> {t('uploading')}</>
            : <><FileCode className="size-4" /> {t('mdToPdf')}</>
          }
        </button>
        <input
          ref={mdInputRef}
          type="file"
          accept=".md,.html,.htm,.txt"
          className="hidden"
          onChange={handleMdFile}
        />

        {/* Paste from clipboard */}
        <button
          onClick={handlePaste}
          disabled={pasting}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background py-2.5 text-sm text-muted-foreground transition-colors hover:border-indigo-500/40 hover:bg-indigo-500/5 hover:text-indigo-500 disabled:opacity-50"
        >
          {pasting
            ? <><Loader2 className="size-4 animate-spin" /> {t('uploading')}</>
            : <><Clipboard className="size-4" /> {t('pasteClipboard')}</>
          }
        </button>
      </div>

      {/* ── File List ── */}
      {hasFiles && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{files.length}</span> {t('filesSelected', { count: files.length })}
                &nbsp;·&nbsp;{formatBytes(totalSize)}
              </span>
              <button
                onClick={clearFiles}
                className="text-xs text-muted-foreground transition-colors hover:text-destructive"
              >
                {t('removeAll')}
              </button>
          </div>
          <div className="divide-y divide-border">
            {files.map((f, i) => (
              <div
                key={`${f.name}-${i}`}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30"
              >
                {getFileIcon(f)}
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{f.name}</span>
                <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                  {formatBytes(f.size)}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(i) }}
                  aria-label="Kaldır"
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Upload Progress ── */}
      {uploadProgress && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground font-medium">{t('uploading')}</span>
            <span className="tabular-nums text-muted-foreground">
              {formatBytes(uploadProgress.loaded)} / {formatBytes(uploadProgress.total)}
              {uploadProgress.rate > 0 && (
                <span className="ml-2">· {formatBytes(uploadProgress.rate)}/s</span>
              )}
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
              style={{ width: `${uploadProgress.pct}%` }}
            />
          </div>
          <div className="text-right text-xs font-medium tabular-nums text-indigo-500">
            {uploadProgress.pct}%
          </div>
        </div>
      )}

      {/* ── Options + CTA ── */}
      {hasFiles && (
        <div className="space-y-2.5">

          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1">
            {([
              { value: 'convert',   label: t('modeConvert'),   Icon: FileText },
              { value: 'summarize', label: t('modeSummarize'),  Icon: Sparkles },
            ] as const).map(({ value, label, Icon }) => (
              <button
                key={value}
                onClick={() => setOption('mode', value)}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-150',
                  options.mode === value
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Merge mode */}
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1">
            {([
              { value: 'separate', label: t('separateFiles'), Icon: Files },
              { value: 'single',   label: t('mergeFiles'),    Icon: FilePlus2 },
            ] as const).map(({ value, label, Icon }) => (
              <button
                key={value}
                onClick={() => setOption('mergeMode', value)}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-150',
                  options.mergeMode === value
                    ? 'bg-muted text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Advanced options accordion */}
          <div className="overflow-hidden rounded-xl border border-border">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center gap-2.5 bg-card px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
            >
              <Settings2 className="size-4 shrink-0" />
              <span className="flex-1 text-left font-medium">{t('advancedOptions')}</span>
              <ChevronDown className={cn('size-4 shrink-0 transition-transform duration-200', showAdvanced && 'rotate-180')} />
            </button>

            {showAdvanced && (
              <div className="border-t border-border bg-muted/20 px-4 py-3">
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {t('aiModel')}
                </label>
                <select
                  value={options.model}
                  onChange={(e) => setOption('model', e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-shadow focus:ring-2 focus:ring-indigo-500/40"
                >
                  {MODELS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* CTA */}
          <button
            onClick={handleStart}
            disabled={starting}
            className={cn(
              'relative w-full rounded-xl py-3.5 text-sm font-semibold transition-all duration-150',
              starting
                ? 'cursor-not-allowed bg-indigo-600/50 text-white/50'
                : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20 hover:opacity-90 active:scale-[0.99]'
            )}
          >
            {starting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                {t('uploading')}
              </span>
            ) : (
              <>
                <span className="absolute inset-y-0 left-4 flex items-center">
                  {options.mode === 'convert'
                    ? <FileText className="size-4" />
                    : <Sparkles className="size-4" />
                  }
                </span>
                <span className="flex items-center justify-center gap-1.5">
                  {options.mode === 'convert' ? t('startButton_convert') : t('startButton_summarize')}
                  {files.length > 1 && (
                    <span className="opacity-70">{t('filesCount', { count: files.length })}</span>
                  )}
                </span>
                <span className="absolute inset-y-0 right-4 flex items-center">
                  <ArrowRight className="size-4" />
                </span>
              </>
            )}
          </button>

        </div>
      )}
    </div>
  )
}
