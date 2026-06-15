# Frontend Rewrite — Yeni Tek Sayfa Arayüz

> **Amaç:** Mevcut Vanilla JS/Tailwind CDN arayüzünü silip, baştan React + Vite + shadcn/ui + Tailwind CSS v4 ile yazmak. Tüm sayfalar tek sayfada birleşecek. Sadece frontend implementasyonu, backend hazır.

---

## 1. Teknoloji Stack

| Paket | Versiyon | Amaç |
|-------|----------|------|
| `react` + `react-dom` | ^19 | UI framework |
| `vite` | ^6 | Build tool |
| `tailwindcss` | ^4 | Utility CSS |
| `shadcn/ui` | latest | Component primitives (button, card, dialog, select, tabs, progress, sonner) |
| `lucide-react` | latest | İkonlar |
| `zustand` | ^5 | State management (minimal, hooks-based) |
| `react-i18next` + `i18next` + `i18next-http-backend` | ^23 | Çoklu dil (TR/EN) |
| `react-router-dom` | ^7 | SPA routing (opsiyonel, tek sayfa olduğundan muhtemelen gerekmez) |
| `marked` | ^18 | Client-side markdown preview |
| `dompurify` | ^3 | Markdown preview XSS koruması |

> **Not:** `react-router-dom` tek sayfa olduğundan muhtemelen gerekmez. Eğer `/summarizer` ve `/md-to-pdf` redirect'lerini yönetmek istersen kullanılır.

---

## 2. Proje Yapısı (`frontend/src/`)

```
frontend/src/
  main.tsx                 # React root, StrictMode
  App.tsx                  # Layout shell (Header + ThemeProvider + Sonner)
  index.css                # Tailwind v4 + CSS variables (dark/light themes)
  
  lib/
    utils.ts               # cn() helper (shadcn default)
    api.ts                 # Fetch wrapper: POST /api/v2/tasks, GET /api/v2/tasks, etc.
  
  stores/
    uiStore.ts             # theme, language, preview drawer state
    uploadStore.ts         # files[], options (mode, format, merge, model)
    taskStore.ts           # tasks[], polling, SSE fallback
  
  components/
    Header.tsx             # Logo, nav (yok artık), lang switch, theme toggle
    UploadSection.tsx      # DropZone + FileList
    OptionsPanel.tsx       # Mode, Format, Merge, Model, Start button
    TaskQueue.tsx          # Aktif + kuyruktaki task kartları
    CompletedTasks.tsx     # Tamamlanan sonuçlar
    TaskCard.tsx           # Tek task: progress, status, cancel, filename
    ResultCard.tsx         # Tek sonuç: preview, big download button, copy, delete
    PreviewDrawer.tsx      # Slide-over/drawer: markdown HTML preview / PDF iframe
    ThemeToggle.tsx        # Dark/Light/System switch
    LangSwitch.tsx         # TR/EN switch
  
  components/ui/           # shadcn/ui primitives (auto-generated)
    button.tsx
    card.tsx
    select.tsx
    progress.tsx
    dialog.tsx
    tabs.tsx
    badge.tsx
    sonner.tsx
    scroll-area.tsx
    separator.tsx
```

---

## 3. State Management (Zustand)

### `uiStore.ts`
```typescript
interface UIStore {
  theme: 'dark' | 'light' | 'system';
  language: 'tr' | 'en';
  previewOpen: boolean;
  previewTaskId: string | null;
  setTheme: (t: 'dark' | 'light' | 'system') => void;
  setLanguage: (l: 'tr' | 'en') => void;
  openPreview: (taskId: string) => void;
  closePreview: () => void;
}
```

### `uploadStore.ts`
```typescript
interface UploadStore {
  files: File[];
  options: {
    mode: 'auto' | 'convert' | 'summarize';
    outputFormat: 'pdf' | 'html' | 'markdown';
    mergeMode: 'single' | 'separate';
    model: string;
  };
  addFiles: (f: FileList | File[]) => void;
  removeFile: (idx: number) => void;
  clearFiles: () => void;
  setOption: <K extends keyof Options>(k: K, v: Options[K]) => void;
  reset: () => void;
}
```

### `taskStore.ts`
```typescript
interface ClientTask {
  id: string;
  type: 'auto' | 'convert' | 'summarize';
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  phase: string;
  message: string;
  progress: number;
  filename: string | null;
  outputFormat: 'pdf' | 'html' | 'markdown';
  aiDecision: 'convert' | 'summarize' | null;
  createdAt: number;
  error: string | null;
}

interface TaskStore {
  tasks: ClientTask[];
  queueStatus: { active: number; queued: number; max: number };
  addOrUpdateTask: (task: ClientTask) => void;
  removeTask: (id: string) => void;
  cancelTask: (id: string) => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  isPolling: boolean;
}
```

---

## 4. Sayfa Bölümleri (Tek Sayfa, Y-scroll)

### 4.1 Header (sticky, z-50)
- Sol: `LevTolstoy` logo + gradient text
- Sağ: `LangSwitch` (TR/EN), `ThemeToggle` (☀️/🌙), `Sonner` toast container
- **Eski nav (Converter/Özetleyici/MD to PDF) kaldırıldı.** Tek sayfa.

### 4.2 Hero / Upload
- Büyük dashed border drop zone. `onDragOver` + `onDrop` + click `input[type=file]` (multiple).
- Açıklama: "PDF, DOCX, PPTX, XLSX, resim, ses, video dosyalarını sürükleyip bırakın"
- Yüklenen dosya listesi: kartlar halinde isim, boyut, silme (×) butonu.

### 4.3 Options Panel (dosya yüklenince görünür)
| Ayar | UI |
|------|-----|
| **AI Modu** | 3-lü segmented button: `Auto` (default), `Tam Dönüştürme`, `Özetle` |
| **Çıktı Formatı** | 3-lü: `PDF` (büyük, primary), `HTML`, `Markdown` |
| **Birleştirme** | Toggle: `Tek Dosya` / `Her Dosya Ayrı` |
| **AI Modeli** | Select dropdown: gemini-3.5-flash, gemini-3-flash-preview, gemini-2.5-flash, gemini-2.5-flash-lite |
| **Başlat** | Full-width gradient CTA buton: "AI ile İşlemi Başlat" |

### 4.4 Task Queue (canlı)
- Her task bir `Card`:
  - Üst: Dosya adı, badge (`status`, `aiDecision`), model
  - Orta: `Progress` bar (animated), yüzde, ETA text
  - Alt: Durum mesajı, İptal butonu (sadece active/queued)
- **3 concurrent**: Aktif task'lar üstte, kuyruktaki altta. `queueStatus` badge göster.
- İşlem devam ederken yeni upload yapılabilir → yeni task kartı eklenir.

### 4.5 Completed Tasks (tamamlananlar)
- Grid: `ResultCard` ×N
- Her kart:
  - Üst: Filename, format badge (PDF/HTML/MD), tarih
  - Önizleme: İlk 3 satır markdown text (veya PDF ikonu)
  - **Büyük Download butonu** (primary, full-width, prominent)
  - Secondary: Kopyala (MD), Sil, Önizle (drawer açar)

### 4.6 Preview Drawer (slide-over / modal)
- Sağdan açılan `Drawer` / `Dialog` (mobilde bottom sheet)
- İçerik:
  - Markdown: `marked` + `DOMPurify` ile HTML render, scrollable
  - PDF: `<iframe src={blobUrl} />`
  - HTML: `<iframe srcdoc={htmlContent} />`
- Header: Dosya adı, kapat butonu, indir butonu

---

## 5. i18n (react-i18next)

```
public/locales/
  tr/
    common.json      # butonlar, toast, başlıklar
    upload.json      # drop zone, dosya listesi
    options.json     # mode, format, merge, model labels
    tasks.json       # status, phase, progress, cancel, retry
    errors.json      # hata mesajları
  en/
    ...
```

`i18n` instance'ı `main.tsx`'te init edilir. `uiStore` dil değişimi `i18n.changeLanguage()` çağırır. Dil değişimi anlık, sayfa refresh olmaz.

---

## 6. Tema & Renkler (Korunacak Mevcut)

CSS variables (Tailwind v4 `theme` + `@theme` block):

```css
@theme {
  --color-background: #0f172a;      /* slate-900 */
  --color-foreground: #f8fafc;      /* slate-50 */
  --color-card: #1e293b;            /* slate-800 */
  --color-card-foreground: #f8fafc;
  --color-border: #334155;          /* slate-700 */
  --color-primary: #6366f1;         /* indigo-500 */
  --color-primary-foreground: #ffffff;
  --color-secondary: #a855f7;       /* purple-500 */
  --color-accent: #3b82f6;          /* blue-500 */
  --color-success: #10b981;           /* emerald-500 */
  --color-warning: #f59e0b;           /* amber-500 */
  --color-error: #ef4444;             /* red-500 */
}
```

Light mode override (`.light` class on `<html>`):
```css
.light {
  --color-background: #ffffff;
  --color-foreground: #0f172a;
  --color-card: #f8fafc;
  --color-border: #e2e8f0;
  --color-primary: #6366f1;
}
```

CTA gradient: `bg-gradient-to-r from-indigo-500 to-purple-600` (bu renkler shadcn Button component'inde `variant="gradient"` olarak eklenebilir).

---

## 7. API Client (`lib/api.ts`)

```typescript
const API_BASE = ''; // Same origin proxy

export const api = {
  createTask: (body: CreateTaskBody) => fetch('/api/v2/tasks', { method: 'POST', body: JSON.stringify(body) }).then(r => r.json()),
  getTasks: () => fetch('/api/v2/tasks').then(r => r.json()),
  getTask: (id: string) => fetch(`/api/v2/tasks/${id}`).then(r => r.json()),
  cancelTask: (id: string) => fetch(`/api/v2/tasks/${id}/cancel`, { method: 'POST' }).then(r => r.json()),
  downloadTask: (id: string, format: 'pdf' | 'html' | 'md') => window.open(`/api/v2/tasks/${id}/download?format=${format}`, '_blank'),
};
```

---

## 8. Implementasyon Sırası (Step-by-Step)

1. **shadcn/ui init** (`npx shadcn@latest init`) + Tailwind v4 config ayarı
2. **CSS variables** (`index.css`) dark/light theme + `data-theme` attribute toggle
3. **i18n setup** (`i18n.ts` + `public/locales/` JSON'lar)
4. **Zustand stores** (`uiStore`, `uploadStore`, `taskStore`)
5. **API client** (`lib/api.ts`)
6. **Layout shell** (`App.tsx`): Header + main container + Sonner
7. **UploadSection**: DropZone + FileList + drag-drop handlers
8. **OptionsPanel**: shadcn Select + Button group + segmented toggle
9. **TaskQueue + TaskCard**: Progress animation + polling loop + cancel action
10. **CompletedTasks + ResultCard**: Big download button + copy + preview trigger
11. **PreviewDrawer**: marked + DOMPurify render + iframe for PDF/HTML
12. **ThemeToggle + LangSwitch**: shadcn dropdown/select
13. **Responsive**: mobile-first, grid breakpoints, drawer bottom sheet
14. **Build**: `vite build` → `dist/` → server static serve olarak ayarla

---

## 9. Önemli Notlar

- **Backend zaten hazır.** `server/v2/` API'leri çalışıyor. Frontend sadece `POST /api/v2/tasks`, `GET /api/v2/tasks`, `POST /api/v2/tasks/:id/cancel`, `GET /api/v2/tasks/:id/download` çağıracak.
- **Polling:** `taskStore` her 2sn'de `GET /api/v2/tasks` yapar. `completed`/`failed`/`cancelled` task'lar için polling hafifletilir (örn. 5sn). SSE (`/api/v2/stream`) opsiyonel.
- **Task kartları:** `uploadStore` `files` array'i boşaltılır. TaskStore'a yeni task eklenir. `TaskQueue` component'i taskStore.tasks.map() ile render eder.
- **Big PDF button:** `outputFormat === 'pdf'` ise `Button size="lg" className="w-full h-14 text-lg font-semibold"` primary gradient.
- **Eski sayfalar silinecek:** `public/index.html`, `public/summarizer.html`, `public/md-to-pdf.html`, `public/js/*`, `public/css/*` (ya da Vite build output'u `public/`'in yerine geçecek). Server `index.html`'yi Vite build output'undan serve etmeli.
