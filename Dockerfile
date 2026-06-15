# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────
# Stage 1: Install backend dependencies
# ─────────────────────────────────────────────────────────────
FROM node:20-slim AS backend-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ─────────────────────────────────────────────────────────────
# Stage 2: Build frontend (Vite + React)
# ─────────────────────────────────────────────────────────────
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ─────────────────────────────────────────────────────────────
# Stage 3: Production runtime
# ─────────────────────────────────────────────────────────────
FROM node:20-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# Runtime dependencies: FFmpeg for media encoding, ca-certificates for HTTPS
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      ca-certificates \
      fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Copy backend production deps
COPY --from=backend-deps /app/node_modules ./node_modules

# Copy backend source
COPY package*.json ./
COPY server/ ./server/

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Create temp dirs and set ownership
RUN mkdir -p temp uploads \
    && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server/index.js"]
