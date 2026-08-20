# Base stage with Bun runtime
FROM oven/bun:1.3.13 AS base
WORKDIR /app

# Copy dependency manifests
COPY package.json bun.lock turbo.json ./
COPY packages ./packages
COPY apps ./apps

# Install all dependencies across monorepo
RUN bun install --frozen-lockfile

# Generate Prisma Client
RUN cd packages/db && bun run prisma generate || true

# -------------------------------------------------------------
# Service runner stage for Bun apps (backend, engine, ws, db, market-maker)
# -------------------------------------------------------------
FROM base AS service
ARG APP_NAME=engine
ENV APP_DIR=apps/${APP_NAME}

WORKDIR /app
CMD ["sh", "-c", "bun ${APP_DIR}/index.ts"]

# -------------------------------------------------------------
# Frontend build and serve stage (Next.js)
# -------------------------------------------------------------
FROM base AS frontend-builder
WORKDIR /app
ENV NODE_ENV=production
ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_WS_URL=wss://exchange.deepanshu.live/ws

RUN cd apps/frontend && bun run build

FROM oven/bun:1.3.13 AS frontend-runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=frontend-builder /app /app

WORKDIR /app/apps/frontend
EXPOSE 3000
CMD ["bun", "run", "start"]
