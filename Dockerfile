# Base stage with Bun runtime for backend microservices
FROM oven/bun:1.3.13 AS base
WORKDIR /app

# Copy dependency manifests and code (excluding frontend via .dockerignore)
COPY package.json bun.lock turbo.json ./
COPY packages ./packages
COPY apps ./apps

# Install all dependencies across monorepo
RUN bun install

# Generate Prisma Client
RUN cd packages/db && bun run prisma generate || true

CMD ["bun", "apps/engine/index.ts"]
