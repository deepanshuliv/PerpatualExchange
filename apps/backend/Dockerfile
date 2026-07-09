FROM oven/bun:1.3.13

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/db/package.json ./packages/db/
COPY packages/redis/package.json ./packages/redis/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN bun install --frozen-lockfile

COPY packages/db ./packages/db
COPY packages/redis ./packages/redis
COPY packages/shared-types ./packages/shared-types
COPY apps/backend ./apps/backend

WORKDIR /app/packages/db
RUN bunx prisma generate

WORKDIR /app/apps/backend

EXPOSE 3001

CMD ["bun", "run", "start"]
