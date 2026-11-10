# Produksjonsbilde for Studio (Next.js standalone). Bygg: docker build -t site .
# Byggargumenter speiler NEXT_PUBLIC_* som må være kjent ved bygg.
FROM node:22-alpine AS base
RUN corepack enable && apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
# Payload trenger secret og database under bygg (prerender). PAYLOAD_DB_PUSH=true lager tabellene i build.db.
ENV PAYLOAD_SECRET=build-only-secret DATABASE_URL=file:./build.db PAYLOAD_DB_PUSH=true STUDIO_URL=http://localhost:3100
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine AS run
ENV NODE_ENV=production PORT=3100 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:3100/admin/login >/dev/null || exit 1
CMD ["node", "server.js"]
