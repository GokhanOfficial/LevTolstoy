# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build frontend (Vite + React)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /build

COPY frontend/package*.json ./
RUN npm ci --prefer-offline --no-audit

COPY frontend/ ./
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Install backend dependencies (including optionals)
#
# Optional deps and what they unlock:
#   googleapis  (~114 MB) — Google Drive DOCX/PPTX/XLSX → PDF conversion
#   @aws-sdk    (~ 10 MB) — S3/R2/MinIO file storage
#   pdf-lib     (~ 23 MB) — PDF manipulation utilities
#   highlight.js (~  9 MB) — Syntax-highlighted code blocks in HTML/PDF export
#   katex       (~  4 MB) — LaTeX math rendering in HTML/PDF export
#
# All optional deps are installed so every feature works out of the box.
# If you need a smaller image and don't use Google Drive/S3, you can add
# --omit=optional back here (saves ~160 MB from node_modules).
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS backend-deps
WORKDIR /build

COPY package*.json ./
RUN npm ci --omit=dev --prefer-offline --no-audit \
    && npm cache clean --force

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: Minimal production runtime
# Key optimizations:
#   - Alpine FFmpeg (~135 MB) vs Debian (~350 MB, includes all X11/GPU libs)
#   - --chown on COPY avoids duplicating layers for chown -R
#   - mkdir in one RUN to reduce layer count
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# FFmpeg for audio/video encoding; ca-certificates already in Alpine base
RUN apk add --no-cache ffmpeg ca-certificates \
    && mkdir -p temp uploads \
    && chown node:node temp uploads

# Copy files with --chown to avoid a separate chown layer
COPY --chown=node:node --from=backend-deps /build/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node server/ ./server/
COPY --chown=node:node --from=frontend-build /build/dist ./frontend/dist

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server/index.js"]
