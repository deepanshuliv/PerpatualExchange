## API Speed Test Results

We hit our API hard to see how fast it responds. Test date: **2026-07-09**, with `bun run dev` running locally.

To run the same tests yourself:

```bash
bun scripts/stress-benchmark.ts          # test our API
bun scripts/external-benchmark.ts        # test Binance + Backpack
```

---

### Words we use (one-line definitions)

| Word | What it means |
|------|----------------|
| **Endpoint** | A URL your app calls, like `GET /depth/BTCUSD` to fetch the order book. |
| **Latency** | How long one request takes, measured in milliseconds (ms). Lower is better. |
| **p50** | Typical speed — half of requests were faster than this. |
| **p95** | Worst-case for most users — 95% of requests were faster than this. **This is the number we care about most.** |
| **RPS** | Requests per second — how many calls the server handled in one second. Higher means it can take more traffic. |
| **Concurrent** | How many requests we sent at the same time (like 200 users clicking at once). |
| **Depth / order book** | List of buy and sell orders waiting in the market. |
| **Ticker / last price** | Price of the most recent trade. |
| **Mark price** | Fair price used for margin and liquidations (not always the last trade price). |
| **Candles / klines** | OHLCV chart data (open, high, low, close, volume) per time bucket. |
| **Onramp** | Add fake money to a test account. |
| **Engine** | Our matching engine — the service that places and matches orders. |
| **Cache** | Saved copy of data in memory (Redis) so we don't recompute every time — very fast. |
| **Postgres** | Our database — correct but a bit slower than cache. |
| **Rate limit** | Exchange blocks you if you send too many requests too fast (HTTP 429). |
| **localhost** | API running on your own machine — no internet delay, so times look artificially fast vs Binance/Backpack. |

---

### How we tested

1. **Our API** — 1,000 requests per endpoint, 200 at a time, all to `http://localhost:3001`.
2. **Binance & Backpack** — 300 requests per endpoint, 50 at a time, over the real internet (includes network delay).

All our endpoints returned **100% success**. Binance blocked some burst traffic (rate limit).

---

### Our API — how fast is each endpoint?

**Focus on the p95 column** — that's "how slow does it get when the server is busy."

#### Anyone can call these (no login)

| What you're fetching | Endpoint | Typical (p50) | Busy server (p95) | Notes |
|----------------------|----------|-----------------|-------------------|-------|
| Order book | `GET /depth/BTCUSD` | 3 ms | 19 ms | From cache — very fast |
| Mark price | `GET /ticker/mark/BTCUSD` | 3 ms | 8 ms | From cache — very fast |
| Last trade price | `GET /ticker/price/BTCUSD` | 28 ms | 65 ms | Reads from database |
| Recent trades | `GET /trades/BTCUSD` | 47 ms | 54 ms | Reads from database |
| Liquidations | `GET /liquidations/BTCUSD` | 27 ms | 45 ms | Reads from database |
| Chart candles (1h) | `GET /candles/BTCUSD/1h` | 27 ms | 33 ms | Reads from database |

#### Needs login (talks to matching engine)

| What you're doing | Endpoint | Typical (p50) | Busy server (p95) | Notes |
|-------------------|----------|-----------------|-------------------|-------|
| Check balance | `GET /equity/available` | 36 ms | 87 ms | Goes through engine |
| List positions | `GET /positions/open/all` | 29 ms | 36 ms | Goes through engine |
| List open orders | `GET /orders/open/all` | 26 ms | 30 ms | Goes through engine |
| List your fills | `GET /fills` | 27 ms | 33 ms | Goes through engine |
| Add test money | `POST /onramp` | 26 ms | 29 ms | Goes through engine |
| Place an order | `POST /order` | 87 ms | **121 ms** | Slowest — runs full matching |

#### Simulation helpers (for load tests)

| What you're doing | Endpoint | Busy server (p95) |
|-------------------|----------|-------------------|
| Create a fake user | `POST /sim/provision` | 17 ms |
| Push a test mark price | `POST /sim/inject-mark-price` | 11 ms |

---

### Us vs Binance vs Backpack

Same type of data, three different exchanges. **Don't compare the ms numbers directly** — our test runs on localhost (no internet lag), Binance/Backpack run over the internet (~150ms+ just for the network).

| What | Our API (p95) | Binance (p95) | Backpack (p95) | Who succeeded? |
|------|---------------|---------------|----------------|----------------|
| Order book | **19 ms** | 332 ms | 451 ms | All OK (Binance 97%) |
| Last price | **65 ms** | 164 ms | 300 ms | Backpack OK; Binance rate-limited |
| Mark price | **8 ms** | 259 ms | 286 ms | Backpack OK; Binance rate-limited |
| Recent trades | **54 ms** | 450 ms | 310 ms | Backpack OK; Binance rate-limited |
| Chart candles | **33 ms** | 193 ms | 392 ms | All OK (Binance 97%) |
| Place order | **121 ms** | not tested* | not tested* | Needs API keys on external exchanges |

\*Binance `POST /fapi/v1/order` and Backpack `POST /api/v1/order` need signed API keys, so we only benchmarked order placement on our API.

**Simple read:** Our cached routes (depth, mark price) are very fast. Database routes are still under ~65ms p95. Placing an order is the slowest action (~121ms) because it actually matches trades. Under heavy load, we handled everything; Binance started rejecting requests.

---

### 3 things to remember

1. **Cache = fast, database = fine, engine = slowest** — depth and mark price use cache; trades/candles use Postgres; placing an order hits the full engine.
2. **p95 under 100ms for almost everything** — even with 200 simultaneous users, most endpoints stay fast.
3. **Localhost numbers aren't "real world"** — production users add network time. Compare exchanges by pattern (we're fast locally, Binance/Backpack include internet delay).

---

## Strategies for Enhancement

- **Lazy Deleting**: When a delete request comes, you store its `orderId` and status in a map. When we are handling the open orders in the order book, we check if the current order is not present in the map using `orderId` and `userId`. This can optimize cancel operations.
- **Fees**: Add trading fees based on maker and taker orders.
- **Insurance**: Add funding insurance and logic: before hitting ADL, consume money from the funding insurance.
- **Buffering**: Add a buffer to send updates at 200ms or 100ms intervals to prevent CPU, network, and browser rendering spikes on the user side.

---

## Current Behavior

- Orders are storing in an array, can be stored in a deque, or a doubly linked list (both have similar complexity profiles).
- From the frontend, the market order price comes along with the quantity. However, the price has a slippage calculated on the frontend, and it should come after applying this slippage.
- In the fills data structure (DS), we are storing a separate entry for `maker_order_id` and `seller_order_id`, but in a single fill entry, we store both `seller_user_id` and `buyer_user_id`.
- Currently, canceling an open order takes $O(n)$ time. With lazy deleting, it can become $O(1)$.
- Right now, any order remaining after a liquidation will stay in the order book forever.
- In order to close a position, you need to send `equity = 0`.
- `costBasis` is the total amount spent in the market to obtain the positions.
- There are no exchange fees (or trading fees) right now, which means there are no insurance funds (historically, half of the trading fees go to exchange profit and the other half to funding insurance).
- When a liquidation hits, if some quantity is not filled, the ADL (Auto-Deleveraging) logic runs immediately. This forcefully places a market order against the opposite side's most profitable positions to close out the losing user's positions.
- The database stores `transactionTime` (matching engine processed timestamp) and `createdAt` (database insertion timestamp), while the WebSocket server broadcasts both `transactionTime` and `executionTime` (live broadcast timestamp) to measure end-to-end latency.
- The backend exposes `GET /ticker/price/:marketId` to retrieve the current Last Traded Price from the database on initial client load (cold starts), while subsequent price ticks are streamed live via WebSockets.
- The Last Traded Price is dynamically calculated at the WebSocket server level from the last element of the fills array in `create_order` and `liquidation` events.
- Funding rate is computed per period as `fundingRate = clamp((localPrice − externalPrice) / externalPrice, −0.05%, +0.05%)`, applied as `margin ± (qty × externalPrice × fundingRate)` — longs pay shorts when the local futures price trades at a premium, and shorts pay longs when it trades at a discount.
- Three distinct prices are tracked in the UI: **Last Price** (price of the most recent matched trade on the local exchange, from fills) only updates when a real trade occurs; **Mark Price** and **Index Price** both stream live from the Binance Futures mark price feed and represent the external fair valuation used for margins, PnL, and liquidation calculations.

---

## Difficult Questions

- What happens if a liquidation order is placed and the opposite side offers a very poor price? Currently, the matching loop runs continuously, consuming all available orders until the complete quantity is filled.

---

## Concepts Learned While Building This Project

- We ensure that we provide pure inputs to functions to guarantee predictable and valid outputs.
- When writing functions, we must first perform validation (checking for invalid conditions) before executing any state mutations (modifying variable values).