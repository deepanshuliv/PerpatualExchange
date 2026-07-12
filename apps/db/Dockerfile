FROM oven/bun:1.3.13

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/db/package.json ./apps/db/
COPY packages/db/package.json ./packages/db/
COPY packages/redis/package.json ./packages/redis/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN bun install --frozen-lockfile

COPY packages/db ./packages/db
COPY packages/redis ./packages/redis
COPY packages/shared-types ./packages/shared-types
COPY apps/db ./apps/db

WORKDIR /app/packages/db
RUN bunx prisma generate

WORKDIR /app/apps/db

CMD ["bun", "run", "start"]
