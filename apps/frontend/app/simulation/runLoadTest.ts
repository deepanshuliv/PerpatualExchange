import { apiService, WS_BASE } from '../hooks/useApi';

export type SimMarket = 'BTCUSD' | 'ETHUSD' | 'SOLUSD';

export interface LoadTestConfig {
  users: number;
  ordersPerUser: number;
  market: SimMarket;
  qtyMin: number;
  qtyMax: number;
  delayMinSec: number;
  delayMaxSec: number;
}

export interface SimUser {
  username: string;
  token: string;
}

const MARKET = {
  BTCUSD: { fallback: 61644, leverage: 75, qtyDec: 4, priceDec: 1 },
  ETHUSD: { fallback: 3020, leverage: 50, qtyDec: 3, priceDec: 2 },
  SOLUSD: { fallback: 135, leverage: 20, qtyDec: 2, priceDec: 3 },
} as const;

const LIQ_MOVE = 0.02;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });

const fmtPrice = (value: number, market: SimMarket) =>
  Number(value.toFixed(MARKET[market].priceDec));

const fmtQty = (value: number, market: SimMarket) =>
  value.toFixed(MARKET[market].qtyDec);

/** Maker below/above mark, or taker through the spread when cross=true. */
const orderPrice = (
  mark: number,
  side: 'LONG' | 'SHORT',
  market: SimMarket,
  cross: boolean,
) => {
  const bump = rand(0.001, cross ? 0.01 : 0.012);
  const mult = side === 'LONG' ? 1 + (cross ? bump : -bump) : 1 + (cross ? -bump : bump);
  return fmtPrice(mark * mult, market);
};

const midFromDepth = (bids: unknown, asks: unknown): number | null => {
  const bidLevels = Array.isArray(bids) ? (bids as [number, number][]) : [];
  const askLevels = Array.isArray(asks) ? (asks as [number, number][]) : [];
  const bestBid = bidLevels.length > 0 ? Math.max(...bidLevels.map((level) => Number(level[0]))) : null;
  const bestAsk = askLevels.length > 0 ? Math.min(...askLevels.map((level) => Number(level[0]))) : null;

  if (bestBid && bestAsk && bestBid > 0 && bestAsk > 0) return (bestBid + bestAsk) / 2;
  if (bestBid && bestBid > 0) return bestBid;
  if (bestAsk && bestAsk > 0) return bestAsk;
  return null;
};

export async function fetchMarkPrice(market: SimMarket): Promise<number> {
  const { fallback } = MARKET[market];

  try {
    const res = await apiService.getMarkPrice(market);
    if (res?.ok && Number(res.price) > 0) return Number(res.price);
  } catch {
    /* try next source */
  }

  try {
    const depth = await apiService.getDepth(market);
    if (depth?.ok && depth.data) {
      const mid = midFromDepth(depth.data.bids, depth.data.asks);
      if (mid) return mid;
    }
  } catch {
    /* try next source */
  }

  return new Promise((resolve) => {
    let done = false;
    const finish = (price: number) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      ws.close();
      resolve(price > 0 ? price : fallback);
    };

    const ws = new WebSocket(WS_BASE);
    const timer = setTimeout(() => finish(fallback), 3000);

    ws.onopen = () =>
      ws.send(JSON.stringify({ method: 'SUBSCRIBE', params: [`markPrice.${market}`], id: 1 }));
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        const price = Number(msg?.data?.price);
        if (msg?.stream?.startsWith('markPrice') && price > 0) finish(price);
      } catch {
        /* ignore */
      }
    };
    ws.onerror = () => finish(fallback);
  });
}

async function getUsers(
  config: LoadTestConfig,
  mark: number,
  log: (line: string) => void,
  signal?: AbortSignal,
): Promise<SimUser[]> {
  const { leverage } = MARKET[config.market];
  const seedCount = Math.max(2, Math.ceil(config.ordersPerUser * 0.5));
  const tradeCount = Math.max(2, Math.ceil(config.ordersPerUser * 0.35));
  const marginPerOrder = (config.qtyMax * mark) / leverage;
  const concurrentSlots = seedCount + tradeCount + 8;
  const fund = Math.max(
    25_000,
    Math.ceil(marginPerOrder * concurrentSlots * 4),
  );

  const users: SimUser[] = [];
  for (let i = 0; i < config.users; i++) {
    signal?.throwIfAborted();
    const username = `sim_${Date.now()}_${i + 1}`;
    const res = await apiService.provisionSimUser(username, fund);
    if (res.status === 201 && res.token) {
      users.push({ username, token: res.token });
      log(`Provisioned ${username} ($${fund.toLocaleString()})`);
    }
  }

  if (users.length > 0) return users;

  const token = localStorage.getItem('perp_token');
  const raw = localStorage.getItem('perp_user');
  if (!token || !raw) return users;

  const name = (JSON.parse(raw) as { username?: string }).username ?? 'logged-in';
  log(`Using logged-in account "${name}" for ${config.users} workers`);
  await apiService.onramp(token, fund * config.users);

  return Array.from({ length: config.users }, (_, i) => ({
    username: `${name}#${i + 1}`,
    token,
  }));
}

async function placeOrder(
  user: SimUser,
  config: LoadTestConfig,
  side: 'LONG' | 'SHORT',
  qty: string,
  price: number,
  tag: string,
  log: (line: string) => void,
) {
  const { leverage } = MARKET[config.market];
  const notional = parseFloat(qty) * price;
  const res = await apiService.placeOrder(user.token, {
    qty,
    price,
    market: config.market,
    type: 'LIMIT',
    kind: side,
    margin: notional / leverage,
  });

  if (res.status === 200 && res.ok) {
    const fill = res.data?.filledQty > 0 ? ` (filled ${res.data.filledQty})` : '';
    log(`${user.username}: ${tag} ${side} ${qty} @ $${price.toLocaleString()}${fill}`);
  } else {
    log(`${user.username}: ${tag} failed — ${res.msg ?? 'error'}`);
  }
}

/** Place N orders per user — resting book or crossing trades. */
async function runOrderBatch(
  users: SimUser[],
  config: LoadTestConfig,
  mark: number,
  count: number,
  cross: boolean,
  tag: string,
  log: (line: string) => void,
  signal?: AbortSignal,
) {
  log(`${tag} — ${count} orders/user…`);
  for (const user of users) {
    for (let i = 0; i < count; i++) {
      signal?.throwIfAborted();
      const side: 'LONG' | 'SHORT' = i % 2 === 0 ? 'LONG' : 'SHORT';
      await placeOrder(
        user,
        config,
        side,
        fmtQty(rand(config.qtyMin, config.qtyMax), config.market),
        orderPrice(mark, side, config.market, cross),
        tag,
        log,
      );
      await wait(rand(config.delayMinSec, config.delayMaxSec) * 1000, signal);
    }
  }
}

async function runLiquidationDemo(
  users: SimUser[],
  config: LoadTestConfig,
  mark: number,
  log: (line: string) => void,
  signal?: AbortSignal,
) {
  const [longUser, shortUser, maker] = [users[0]!, users[1] ?? users[0]!, users[2] ?? users[0]!];
  const qty = fmtQty(Math.max(config.qtyMax * 2, config.qtyMin * 3), config.market);
  const deepQty = fmtQty(parseFloat(qty) * 2, config.market);

  log('Liquidation demo — open positions, then shock mark price…');

  await placeOrder(maker, config, 'SHORT', deepQty, fmtPrice(mark * 1.002, config.market), 'liq ask', log);
  await placeOrder(maker, config, 'LONG', deepQty, fmtPrice(mark * 0.998, config.market), 'liq bid', log);
  await wait(400, signal);

  await placeOrder(longUser, config, 'LONG', qty, fmtPrice(mark * 1.004, config.market), 'liq LONG', log);
  await wait(300, signal);
  await placeOrder(shortUser, config, 'SHORT', qty, fmtPrice(mark * 0.996, config.market), 'liq SHORT', log);
  await wait(800, signal);

  const markDown = fmtPrice(mark * (1 - LIQ_MOVE), config.market);
  const markUp = fmtPrice(mark * (1 + LIQ_MOVE), config.market);

  log(`Inject mark $${markDown.toLocaleString()} → liquidate LONGs`);
  await apiService.injectMarkPrice(config.market, markDown);
  await wait(1500, signal);

  log(`Inject mark $${markUp.toLocaleString()} → liquidate SHORTs`);
  await apiService.injectMarkPrice(config.market, markUp);
}

export async function runLoadTest(
  config: LoadTestConfig,
  log: (line: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  log('Fetching mark price…');
  const mark = await fetchMarkPrice(config.market);
  log(`Mark price: $${mark.toLocaleString(undefined, { minimumFractionDigits: 1 })}`);

  signal?.throwIfAborted();

  const users = await getUsers(config, mark, log, signal);
  if (users.length === 0) {
    throw new Error('No users available — start backend + engine, or log in on the trading UI.');
  }

  log('Waiting for balances to settle…');
  await wait(1500, signal);

  const seedCount = Math.max(2, Math.ceil(config.ordersPerUser * 0.5));
  const tradeCount = Math.max(2, Math.ceil(config.ordersPerUser * 0.35));

  await runOrderBatch(users, config, mark, seedCount, false, 'Seed book', log, signal);
  await wait(500, signal);
  await runOrderBatch(users, config, mark, tradeCount, true, 'Generate trades', log, signal);
  await wait(500, signal);
  await runLiquidationDemo(users, config, mark, log, signal);

  log('Done — watch Book, Trades, and Liquidation tabs on the trading UI.');
}
