FROM oven/bun:1.3.13

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/engine/package.json ./apps/engine/
COPY packages/redis/package.json ./packages/redis/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN bun install --frozen-lockfile

COPY packages/redis ./packages/redis
COPY packages/shared-types ./packages/shared-types
COPY apps/engine ./apps/engine

RUN mkdir -p /app/apps/engine/snapshots

WORKDIR /app/apps/engine

CMD ["bun", "run", "start"]
