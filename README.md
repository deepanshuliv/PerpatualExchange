# Axiom

Axiom is a personal study implementation of a perpetual cryptocurrency exchange with an in-memory matching engine, a REST API, live WebSocket market data, and asynchronous persistence.

**Status:** Personal project / prototype. It is not a production trading system and should not be used with real credentials or funds.

## What is included

- An in-memory order book, balance manager, position manager, funding-rate handling, and liquidation flow in `apps/engine`.
- An Express API in `apps/backend` for authentication, balances, orders, positions, fills, market data, and simulation helpers.
- A WebSocket service in `apps/ws` with subscriptions for depth, trades, last-traded price, mark price, funding, liquidations, and candles.
- A database consumer in `apps/db` that persists order events, fills, ticks, and 1m/5m/15m/1h/1d candles.
- A market-maker process in `apps/market-maker` that submits orders to the engine.
- A Next.js trading interface in `apps/frontend`, including order entry, order-book views, charts, authentication, and the `/simulation` load-test page.

## Quick start with Docker Compose

Prerequisites:

- [Bun](https://bun.sh/) 1.3.13, as declared by the root `package.json`.
- Docker with the Compose plugin.
- Network access for the engine's default Binance Futures mark-price WebSocket.

Create the local environment file:

```bash
bun install
cp .env.example .env
```

Before starting the stack, edit `.env` and set non-empty values for `POSTGRES_PASSWORD` and `JWT_SECRET`. For a local Compose setup, use these browser-facing URLs:

```dotenv
CORS_ORIGINS=http://localhost
NEXT_PUBLIC_API_URL=http://localhost/api
NEXT_PUBLIC_WS_URL=ws://localhost/ws
```

Build the images, migrate the database, and start the services:

```bash
docker compose build --pull
docker compose up -d postgres redis
docker compose run --rm -w /app/packages/db db-consumer \
  bun run prisma migrate deploy
docker compose up -d
```

The Compose setup exposes Caddy on ports 80 and 443. Check the backend through the local proxy:

```bash
curl http://localhost/api/healthz
```

Open `http://localhost` for the frontend. If `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_WS_URL` changes, rebuild the `frontend` image because Next.js embeds those values into the browser bundle.

## Running services without Docker

`bun run dev` starts the development tasks managed by Turborepo. Redis and Postgres must already be running, and `.env` must point to addresses reachable from the host process; the Compose hostnames `redis` and `postgres` are only available inside the Compose network.

```bash
bun run dev
```

In this mode, the frontend uses Next.js on port 3000, the backend defaults to port 3001, and the WebSocket service defaults to port 8080. The frontend's API and WebSocket URLs must match the mode you choose.

## HTTP API

The backend routes are rooted at `/`. When Caddy is used, the public frontend hostname exposes them below `/api` and strips that prefix before forwarding to Express.

Unauthenticated routes include:

- `GET /healthz`
- `POST /signup` and `POST /signin`
- `POST /sim/provision` and `POST /sim/inject-mark-price`
- `GET /depth/:marketId`, `/ticker/price/:marketId`, and `/ticker/mark/:marketId`
- `GET /trades/:marketId`, `/liquidations/:marketId`, and `/candles/:marketId/:interval`

Authenticated routes require `Authorization: Bearer <token>`:

- `POST /onramp`, `/order`, and `/order/cancel`
- `GET /equity/available`, `/positions/open/:marketId`, `/orders/open/:marketId`, and `/fills`

The order request schema accepts `LIMIT` and `MARKET` orders with `LONG` or `SHORT` direction. The shared market schema currently accepts `BTCUSD`, `ETHUSD`, `SOLUSD`, and `USD`; the frontend selector exposes the three perpetual markets backed by the Binance listener.

For example, with the backend running directly on the host:

```bash
API_BASE=http://localhost:3001

curl -s "$API_BASE/healthz"

curl -s -X POST "$API_BASE/signup" \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"use-a-local-test-password"}'
```

The signup response contains a JWT. Use that token for authenticated requests. `/onramp` adds demo balance through the engine; it is not a payment integration.

## WebSocket subscriptions

The WebSocket server accepts JSON messages with `SUBSCRIBE` or `UNSUBSCRIBE` and a list of stream names. A successful subscription returns `{ "result": null, "id": ... }`.

```json
{
  "method": "SUBSCRIBE",
  "params": ["depth.BTCUSD", "trade.BTCUSD", "candle.BTCUSD.1m"],
  "id": 1
}
```

Stream names are formed as follows:

- `depth.<market>`
- `trade.<market>`
- `lastTradedPrice.<market>`
- `markPrice.<market>`
- `funding.<market>`
- `liquidation.<market>`
- `candle.<market>.<interval>`, where `<interval>` is `1m`, `5m`, `15m`, `1h`, or `1d`

## How it works

The services communicate through Redis Streams rather than calling the engine over HTTP:

1. `apps/backend` validates an HTTP request, writes a correlated request to the `to-engine` stream, and waits for the matching response on `to-backend`.
2. `apps/engine` consumes `to-engine`, updates its in-memory order book, balances, and positions, then publishes correlated responses and market events to `to-backend`.
3. `apps/ws` consumes market events from `to-backend` and broadcasts only to clients subscribed to the corresponding stream. It also builds a bounded in-process live candle history.
4. `apps/db` consumes persistence events from `to-backend` through its own consumer group and writes users, orders, fills, ticks, and candles to Postgres/TimescaleDB.
5. The engine's Binance listener converts BTCUSDT, ETHUSDT, and SOLUSDT mark-price messages into `BTCUSD`, `ETHUSD`, and `SOLUSD` engine events.

The engine keeps its operational state in memory. It writes `snapshot-latest.json` to the `engine_snapshots` Docker volume every three seconds and can also copy that snapshot to an S3-compatible R2 bucket when the R2 variables are configured.

## Configuration

The root [`.env.example`](./.env.example) contains the environment values used by the Compose deployment. The most important groups are:

- Database and Redis: `DATABASE_URL`, `REDIS_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`.
- API and browser routing: `JWT_SECRET`, `CORS_ORIGINS`, `NEXT_PUBLIC_API_URL`, and `NEXT_PUBLIC_WS_URL`.
- Stream names and consumer identities: `ENGINE_STREAM`, `BACKEND_STREAM`, `WS_CONSUMER_GROUP`, `WS_CONSUMER_NAME`, `DB_CONSUMER_GROUP`, and `DB_CONSUMER_NAME`.
- External prices and engine snapshots: `BINANCE_STREAM_URL`, `SNAPSHOT_DIR`, and the optional `R2_*` variables.
- Resource limits and retention: `ENGINE_MAX_IN_MEMORY_FILLS`, `ENGINE_MAX_OPEN_ORDERS`, `WS_MAX_CLIENTS`, `WS_MAX_BUFFERED_BYTES`, and `HISTORY_RETENTION_DAYS`.

Compose provides service-specific Redis and Postgres URLs inside the Docker network. For host processes, use host-reachable URLs such as `redis://localhost:6379` and a Postgres URL whose hostname is `localhost`.

## Development commands

Run these from the repository root:

```bash
bun run dev          # start development tasks through Turborepo
bun run build        # run build tasks through Turborepo
bun run lint         # run configured linters
bun run check-types  # run TypeScript checks
bun run format       # format TypeScript and Markdown files
```

The root package does not define a test script. Its `check-types` entry currently has no package-level Turbo task, so Turbo reports that no type-check tasks were executed. The repository does include a manual API stress script:

```bash
bun scripts/stress-benchmark.ts
```

It targets `http://localhost:3001` by default, provisions simulation users, exercises the API routes, and writes `scripts/stress-benchmark-results.json`. Set `API_BASE`, `CONCURRENCY`, and `REQUESTS` to change its target and workload.

## Operational limits and prototype gaps

- Redis streams are written with approximate `MAXLEN` trimming at 100,000 entries.
- The engine caps in-memory fills and resting limit orders using `ENGINE_MAX_IN_MEMORY_FILLS` and `ENGINE_MAX_OPEN_ORDERS`; both default to 100,000.
- The WebSocket service defaults to 1,000 clients and disconnects slow consumers above `WS_MAX_BUFFERED_BYTES`.
- The database migration applies 30-day retention to raw ticks. The database consumer removes fills and terminal orders older than `HISTORY_RETENTION_DAYS`, which defaults to 90 days.
- Engine snapshots are recovery checkpoints, not a replacement for database backups. The deployment still requires disk and memory monitoring.
- Authentication currently stores and compares the password field directly in the `user` table. Do not reuse real passwords.
- `/onramp` credits a demo balance. `DEPLOYMENT.md` documents what would be required for a real payment flow.

## Deployment

[`DEPLOYMENT.md`](./DEPLOYMENT.md) documents the GCP Compute Engine VM setup, Cloudflare DNS, Caddy routing, migrations, verification commands, updates, and storage considerations.

## Repository layout

- `apps/engine` — matching engine and Binance mark-price listener
- `apps/backend` — Express API and engine request bridge
- `apps/ws` — WebSocket server and event broadcaster
- `apps/db` — Redis consumer and database persistence
- `apps/market-maker` — automated order submitter
- `apps/frontend` — Next.js trading UI
- `packages/shared-types` — Zod schemas and shared event types
- `packages/db` — Prisma schema, client, and migrations
- `packages/redis` — shared Redis client
- `scripts` — manual stress and external benchmark scripts
