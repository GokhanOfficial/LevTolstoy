# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app

# Install dependencies first for better Docker layer caching.
COPY package*.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# Install FFmpeg and fonts only (no Chromium needed anymore)
RUN apk add --no-cache \
      ffmpeg \
      ca-certificates \
      ttf-freefont

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
