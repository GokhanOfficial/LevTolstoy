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
    -   **Audio:** MP3, WAV, OGG
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
-   **Tools:** Marked.js, Highlight.js, KaTeX

## 📄 License

This project is licensed under the MIT License - see the `LICENSE` file for details.
