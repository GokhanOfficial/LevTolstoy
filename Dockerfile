# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Install dependencies first for better Docker layer caching.
COPY package*.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# Puppeteer/md-to-pdf may need Chromium and fonts at runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        chromium \
        ca-certificates \
        fonts-liberation \
        fonts-noto \
        fonts-noto-color-emoji \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libcairo2 \
        libcups2 \
        libdbus-1-3 \
        libdrm2 \
        libgbm1 \
        libglib2.0-0 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libpango-1.0-0 \
        libx11-6 \
        libx11-xcb1 \
        libxcb1 \
        libxcomposite1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxrandr2 \
        xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Use the system Chromium installed above instead of a bundled browser cache.
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package*.json ./
RUN npm ci --omit=dev \
    && npm cache clean --force

COPY --from=build /app/public ./public
COPY --from=build /app/server ./server

RUN mkdir -p public/cache \
    && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "start"]
