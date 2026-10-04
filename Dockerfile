FROM node:24.14-alpine AS deps

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# better-sqlite3 falls back to a native build on Alpine/musl.
# Keep the compiler toolchain out of the production runner image.
RUN apk add --no-cache --virtual .native-build-deps python3 make g++ \
    && corepack enable \
    && pnpm install --frozen-lockfile \
    && apk del .native-build-deps

FROM node:24.14-alpine AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && pnpm run build

FROM node:24.14-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATA_DIR=/data
ENV UPLOAD_DIR=/data/uploads
ENV DATABASE_URL=file:/data/app.db

RUN mkdir -p /data/uploads && chown -R node:node /data /app

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
COPY --from=builder --chown=node:node /app/scripts/cleanup-expired-files.mjs ./scripts/cleanup-expired-files.mjs
COPY --from=builder --chown=node:node /app/src/server/storage/upload-deletion-lock.mjs ./src/server/storage/upload-deletion-lock.mjs

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

EXPOSE 3000

CMD ["node", "server.js"]
