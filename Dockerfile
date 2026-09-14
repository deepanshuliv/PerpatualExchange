FROM oven/bun:1.3.13 AS base
WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY packages ./packages
COPY apps ./apps

RUN bun install

RUN cd packages/db && bun run prisma generate || true

CMD ["bun", "apps/engine/index.ts"]
