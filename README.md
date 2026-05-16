# LevTolstoy 🖋️

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20-green.svg)

**LevTolstoy** is an advanced AI-powered tool that converts **PDF, PPTX, DOCX, XLSX** files, and **Images** into clean, editable **Markdown**. It leverages the power of Large Language Models (LLMs) via the **OpenAI API** standard (support for GPT-4o, Gemini via proxy, and others).

Beyond conversion, it features a robust Markdown editor, a document summarizer, and a modern, theme-aware user interface.

<p align="center">
  <img src="docs/screenshots/1.jpg" alt="LevTolstoy App Screenshot 1" width="45%">
  <img src="docs/screenshots/2.jpg" alt="LevTolstoy App Screenshot 2" width="45%">
</p>

## ✨ Features

-   **🤖 AI-Powered Conversion:** Extracts text and complex layouts using state-of-the-art LLMs (default: `gpt-4o`).
-   **📁 Multi-Format Support:**
    -   **Documents:** PDF, Text, Markdown
    -   **Office:** PPTX (PowerPoint), DOCX (Word), XLSX (Excel) _(Requires Google Drive API)_
    -   **Images:** PNG, JPG, WEBP, GIF
    -   **Audio:** MP3, WAV, OGG, M4A, AAC, OPUS, FLAC, WebM Audio _(FFmpeg conversion when needed)_
    -   **Video:** MP4, MOV, AVI, MKV, WebM, 3GP, M4V, MPEG, WMV, FLV _(audio is extracted and converted to MP3)_
-   **☁️ Cloud Storage:** Integrated S3 support (AWS, MinIO, Cloudflare R2) for handling large file uploads securely.
-   **📝 Rich Markdown Editor:** built-in editor with syntax highlighting, live preview, and split view.
-   **📑 Summarizer:** AI-driven document summarization tool.
-   **🎨 Modern UI:** Beautiful interface with **Dark/Light** theme support.
-   **🌍 Multilingual:** Fully localized (English & Turkish).

## 🚀 Getting Started

### Prerequisites

-   **Node.js 20** or higher.
-   **OpenAI API Key** (or a compatible API like OpenRouter, Gemini Proxy).
-   **(Recommended)** S3-compatible object storage (AWS S3, MinIO, R2).
-   **(Optional)** Google Cloud Project for Office file conversion.
-   **FFmpeg + FFprobe** for video/audio conversion. Docker images include them automatically; Linux installs can use the system `ffmpeg`/`ffprobe` commands or custom paths via `.env`.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/GokhanOfficial/LevTolstoy.git
    cd LevTolstoy
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configuration:**
    Copy `.env.example` to `.env` and configure your keys.
    ```bash
    cp .env.example .env
    ```

    **Key Environment Variables:**
    ```env
    # AI Provider (OpenAI Compatible)
    OPENAI_API_KEY=sk-...
    OPENAI_BASE_URL=https://api.openai.com/v1 # or your proxy URL

    # Media conversion
    MAX_FILE_SIZE=1024
    MAX_UPLOAD_SIZE_MB=1024
    FFMPEG_PATH=ffmpeg
    FFPROBE_PATH=ffprobe
    MEDIA_MAX_OUTPUT_SIZE_MB=100
    MEDIA_TARGET_OUTPUT_SIZE_MB=95
    MEDIA_MIN_AUDIO_BITRATE_KBPS=32
    MEDIA_MAX_AUDIO_BITRATE_KBPS=320

    # Storage (S3) - Optional but recommended for production
    S3_ENDPOINT=https://s3.eu-central-1.amazonaws.com
    S3_REGION=eu-central-1
    S3_BUCKET_NAME=my-bucket
    S3_ACCESS_KEY_ID=...
    S3_SECRET_ACCESS_KEY=...
    ```

4.  **Google Drive Setup (for Office Files):**
    _Required only if you want to convert .pptx, .docx, .xlsx files._
    
    1.  Create a project in [Google Cloud Console](https://console.cloud.google.com/).
    2.  Enable **Google Drive API**.
    3.  Create OAuth 2.0 Credentials (Desktop App) and download Client ID/Secret.
    4.  Add them to `.env`:
        ```env
        GOOGLE_CLIENT_ID=...
        GOOGLE_CLIENT_SECRET=...
        ```
    5.  Run the auth script locally to generate a token:
        ```bash
        npm run auth
        ```
        _This will create a `.google-token.json` file. For production, you can copy this file content into the `GOOGLE_TOKEN` env variable._

5.  **Start the server:**
    ```bash
    npm run dev
    ```
    Access at `http://localhost:3000`.

## 🎬 Media Conversion

LevTolstoy accepts source media uploads up to **1GB**. Files sent to the AI provider are kept below the **100MB** audio limit:

- Video files are processed server-side with FFmpeg; the first audio stream is extracted and rendered as MP3.
- Audio formats other than native MP3/WAV/OGG are converted to MP3.
- Native MP3 files under 100MB are used directly.
- MP3 files over 100MB are re-rendered using the most suitable bitrate for a target size of 95MB.
- The encoder never goes below `32kbps`; if a file cannot fit under 100MB at that bitrate, conversion fails with a clear error.
- Upload progress shows percentage, transferred/total size, average speed, and ETA. Conversion progress shows the active phase, current file, FFmpeg percentage, bitrate, and supports cancellation.

Docker deployments install FFmpeg/FFprobe inside the runtime image. Native Linux deployments use `ffmpeg` and `ffprobe` from `PATH` by default, or `FFMPEG_PATH` and `FFPROBE_PATH` from `.env`.

## 📦 Deployment

### Docker Compose

The project now includes `Dockerfile` and `docker-compose.yml` files that are compatible with the existing `.env` structure.

1.  Copy `.env.example` to `.env` and fill in the values:
    ```bash
    cp .env.example .env
    ```

2.  Build the image and start the application:
    ```bash
    docker compose up --build -d
    ```

3.  Check status:
    ```bash
    docker compose ps
    ```

4.  Follow logs:
    ```bash
    docker compose logs -f levtolstoy
    ```

5.  Stop the application:
    ```bash
    docker compose down
    ```

Default URL: `http://localhost:3000`. If you change `PORT` in `.env`, Compose uses the same value for the port mapping.

**Notes:**
-   `docker-compose.yml` passes `.env` directly into the container with `env_file`.
-   If S3 is not configured, temporary files are persisted in the `levtolstoy-cache` volume.
-   Chromium and required fonts are installed in the runtime image for Markdown → PDF features.
-   FFmpeg and FFprobe are installed in the runtime image for media conversion.
-   For Google Drive OAuth in production, using the `GOOGLE_TOKEN` env variable is recommended. If file-based token persistence is required, uncomment the `./server/.google-token.json` volume line in `docker-compose.yml`.

### Docker CLI

To run without Compose:

```bash
docker build -t levtolstoy:latest .
docker run --rm -p 3000:3000 --env-file .env -v levtolstoy-cache:/app/public/cache levtolstoy:latest
```

### Dokploy / Nixpacks

This project is optimized for deployment using **Docker** or **Nixpacks** (used by Dokploy, Railway, etc.).

**Requirements:**
-   Ensure your build environment uses **Node.js 20**.
-   The project includes a `nixpacks.toml` configuration for seamless deployment on Dokploy.

**Persistent Google Token in Production:**
Since the Google Refresh Token expires in 7 days for "Testing" projects:
1.  Go to Google Cloud Console > **OAuth consent screen**.
2.  Set status to **"PUBLISH APP"** (Production).
3.  Generate the token locally (`npm run auth`).
4.  Copy the JSON content of `.google-token.json` and set it as `GOOGLE_TOKEN` environment variable in your deployment platform.

## 🛠️ Built With

-   **Backend:** Node.js, Express, AWS SDK v3
-   **Frontend:** HTML5, TailwindCSS (Vanilla JS)
-   **AI Integration:** OpenAI SDK
-   **Storage:** S3 (AWS SDK)
-   **Media:** FFmpeg / FFprobe
-   **Tools:** Marked.js, Highlight.js, KaTeX

## 📄 License

This project is licensed under the MIT License - see the `LICENSE` file for details.
