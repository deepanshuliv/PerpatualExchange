FROM oven/bun:1.3.13

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/ws/package.json ./apps/ws/
COPY packages/redis/package.json ./packages/redis/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN bun install --frozen-lockfile

COPY packages/redis ./packages/redis
COPY packages/shared-types ./packages/shared-types
COPY apps/ws ./apps/ws

WORKDIR /app/apps/ws

EXPOSE 8080

CMD ["bun", "run", "start"]
