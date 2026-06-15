# Frontend Rewrite — Adım Adım Yapılacaklar

> **Mevcut durum:** Backend v2 hazır (`server/v2/`). Eski Vanilla JS frontend (`public/index.html`, `public/js/*`, `public/css/*`) hala çalışıyor ve aynı görünüyor.
> **Hedef:** Eski frontend'i tamamen silip, `frontend/` klasöründeki Vite + React + TypeScript projesini deploy edilecek hale getirmek.

---

## 1. Eski Frontend'i Temizle

`public/` klasöründeki eski dosyaları kaldır:
- `public/index.html` (eski)
- `public/summarizer.html`
- `public/md-to-pdf.html`
- `public/js/*`
- `public/css/*`
- Sadece `public/favicon.svg` ve `public/icons.svg` kalabilir (yeni Vite build'i bunların üzerine yazacak)

---

## 2. Vite Build Çıktısını Server'a Entegre Et

`server/index.js` içinde:
- `app.use(express.static('public'))` yerine, `dist/` klasörünü serve et (Vite build output)
- Eğer `NODE_ENV=production` ise `app.use(express.static('frontend/dist'))`
- SPA fallback: `app.get('*', (req, res) => res.sendFile(path.resolve('frontend/dist/index.html')))` — ama sadece `/api*` olmayan route'lar için

---

## 3. React Uygulamasını Doldur (frontend/src/)

Aşağıdaki dosyaları sırayla oluştur. Her biri bağımsız, baştan yazılabilir.

### 3.1. Zustand Stores (state management)
- `src/stores/uiStore.ts` — theme, language, preview drawer
- `src/stores/uploadStore.ts` — files, options (mode, format, merge, model)
- `src/stores/taskStore.ts` — tasks array, polling loop, cancel action

### 3.2. API Client
- `src/lib/api.ts` — `fetch` wrapper: `POST /api/v2/tasks`, `GET /api/v2/tasks`, `POST /api/v2/tasks/:id/cancel`, `GET /api/v2/tasks/:id/download`

### 3.3. i18n
- `src/i18n.ts` — `react-i18next` init
- `public/locales/tr/` ve `public/locales/en/` — JSON çeviri dosyaları (common, upload, options, tasks, errors)

### 3.4. Layout & Shell
- `src/App.tsx` — `Header` + `main` container + `Sonner` (toast)
- `src/components/Header.tsx` — Logo + `LangSwitch` + `ThemeToggle`
- `src/components/ThemeToggle.tsx` — ☀️/🌙/System cycle
- `src/components/LangSwitch.tsx` — TR/EN toggle

### 3.5. Upload Bölümü
- `src/components/UploadSection.tsx` — DropZone (drag & drop) + dosya listesi + silme butonu

### 3.6. Seçenekler Paneli
- `src/components/OptionsPanel.tsx` — 3'lü mode toggle (Auto / Convert / Summarize), format toggle (PDF/HTML/MD), merge toggle (Single/Separate), model select, **büyük gradient CTA buton**

### 3.7. Task Kuyruğu (Canlı)
- `src/components/TaskQueue.tsx` — Aktif işlemler listesi
- `src/components/TaskCard.tsx` — Progress bar + durum badge + iptal butonu

### 3.8. Tamamlananlar
- `src/components/CompletedTasks.tsx` — Grid of `ResultCard`
- `src/components/ResultCard.tsx` — **Büyük download butonu** + copy + preview + delete

### 3.9. Preview Drawer
- `src/components/PreviewDrawer.tsx` — Sağdan açılan panel: markdown HTML preview, PDF iframe, HTML iframe

### 3.10. UI Primitives (shadcn/ui)
- `src/components/ui/button.tsx` — `variant="gradient"` ekle
- `src/components/ui/card.tsx`, `progress.tsx`, `badge.tsx`, `sonner.tsx`

---

## 4. CSS & Theme

- `src/index.css` — Tailwind v4 `@theme` bloğu ile CSS variables (dark/light)
- Dark: `background: #0f172a`, `primary: #6366f1`
- Light: `background: #ffffff`, `primary: #6366f1`
- `html.light` class toggle

---

## 5. Build & Test

```bash
cd frontend
npm run build
```

- `frontend/dist/` oluşmalı
- Server `dist/`'yi static olarak serve etmeli
- `localhost:3000` (veya hangi portsa) açıldığında yeni React UI gözükmeli
- Eski `public/index.html` artık erişilememeli

---

## 6. Önemli Notlar

- **Tek sayfa:** Converter + Summarizer + MD-to-PDF artık ayrı sayfa değil, hepsi tek sayfada
- **AI modu:** `auto` seçildiğinde backend karar verir (`convert` veya `summarize`)
- **Max 3 concurrent:** Backend zaten `p-queue` ile hallediyor, frontend sadece `GET /api/v2/tasks` polling yapıyor
- **Big PDF button:** `outputFormat === 'pdf'` ise `Button size="lg" variant="gradient" className="w-full h-14"`
- **Polling:** `taskStore` her 2sn'de `GET /api/v2/tasks` çağırır
