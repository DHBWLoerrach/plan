# syntax=docker.io/docker/dockerfile:1

FROM node:26-slim AS base

FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

RUN addgroup --system --gid 1002 nextjs \
  && adduser --system --uid 1002 --ingroup nextjs nextjs

COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static

# Keep the documented operational commands available in the production image.
COPY --from=builder --chown=nextjs:nextjs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nextjs /app/migrations ./migrations
COPY --from=builder --chown=nextjs:nextjs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nextjs /app/lib ./lib

RUN mkdir -p /app/data /app/.next/cache /backup \
  && chown -R nextjs:nextjs /app/data /app/.next/cache /backup

USER nextjs:nextjs

EXPOSE 3000

CMD ["node", "server.js"]
