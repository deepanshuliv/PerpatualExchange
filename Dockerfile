FROM oven/bun:1.3.13 AS base
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_WS_URL=

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}

COPY package.json bun.lock turbo.json ./
COPY packages ./packages
COPY apps ./apps

RUN bun install --frozen-lockfile

RUN cd packages/db && bun run prisma generate || true
RUN cd apps/frontend && bun run build

CMD ["bun", "apps/engine/index.ts"]
