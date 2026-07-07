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

const MARKET_DEFAULTS: Record<SimMarket, number> = {
  BTCUSD: 61644,
  ETHUSD: 3020,
  SOLUSD: 135,
};

const MARKET_LEVERAGE: Record<SimMarket, number> = {
  BTCUSD: 75,
  ETHUSD: 50,
  SOLUSD: 20,
};

const QTY_DECIMALS: Record<SimMarket, number> = {
  BTCUSD: 4,
  ETHUSD: 3,
  SOLUSD: 2,
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
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
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomSide(): 'LONG' | 'SHORT' {
  return Math.random() < 0.5 ? 'LONG' : 'SHORT';
}

function priceAroundIndex(indexPrice: number): number {
  const spread = indexPrice * 0.01;
  return Number((indexPrice - spread + Math.random() * spread * 2).toFixed(1));
}

export async function fetchIndexPrice(market: SimMarket): Promise<number> {
  const ticker = await apiService.getTickerPrice(market);
  if (ticker?.ok && ticker.price > 0) {
    return ticker.price;
  }

  return new Promise((resolve) => {
    const fallback = MARKET_DEFAULTS[market];
    let settled = false;
    const ws = new WebSocket(WS_BASE);

    const finish = (price: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      resolve(price > 0 ? price : fallback);
    };

    const timeout = setTimeout(() => finish(fallback), 4000);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          method: 'SUBSCRIBE',
          params: [`markPrice.${market}`, `lastTradedPrice.${market}`],
          id: 1,
        }),
      );
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (!payload?.stream || !payload?.data) return;
        const price = Number(payload.data.price);
        if (price > 0) {
          finish(price);
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => finish(fallback);
    ws.onclose = () => finish(fallback);
  });
}

async function ensureUser(
  index: number,
  log: (line: string) => void,
  signal?: AbortSignal,
): Promise<SimUser | null> {
  const username = `sim_${Date.now()}_${index}`;
  const password = 'sim123';

  let token: string | undefined;

  const signup = await apiService.signup(username, password);
  if (signup.status === 201 && signup.token) {
    token = signup.token;
    log(`Created user ${username}`);
  } else {
    const signin = await apiService.signin(username, password);
    if (signin.status === 200 && signin.token) {
      token = signin.token;
      log(`Signed in existing user ${username}`);
    }
  }

  if (!token) {
    log(`Failed to provision user ${username}`);
    return null;
  }

  signal?.throwIfAborted();

  const onramp = await apiService.onramp(token, 10000);
  if (onramp.status !== 201 || !onramp.ok) {
    log(`Onramp failed for ${username} — continuing with existing balance`);
  }

  return { username, token };
}

export async function runLoadTest(
  config: LoadTestConfig,
  log: (line: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const leverage = MARKET_LEVERAGE[config.market];
  const qtyDecimals = QTY_DECIMALS[config.market];

  log('Fetching index price from feed…');
  const indexPrice = await fetchIndexPrice(config.market);
  log(`Index price: $${indexPrice.toLocaleString(undefined, { minimumFractionDigits: 1 })}`);

  signal?.throwIfAborted();

  log(`Provisioning ${config.users} simulator user(s)…`);
  const simUsers: SimUser[] = [];

  for (let i = 0; i < config.users; i++) {
    signal?.throwIfAborted();
    const user = await ensureUser(i + 1, log, signal);
    if (user) simUsers.push(user);
  }

  if (simUsers.length === 0) {
    throw new Error('No simulator users could be created');
  }

  log(`Starting load test — ${config.ordersPerUser} orders/user across ${simUsers.length} user(s)`);

  const tasks = simUsers.map(async (simUser) => {
    for (let orderNum = 1; orderNum <= config.ordersPerUser; orderNum++) {
      signal?.throwIfAborted();

      const side = randomSide();
      const qty = randomBetween(config.qtyMin, config.qtyMax).toFixed(qtyDecimals);
      const price = priceAroundIndex(indexPrice);
      const margin = (parseFloat(qty) * price) / leverage;

      const result = await apiService.placeOrder(simUser.token, {
        qty,
        price,
        market: config.market,
        type: 'LIMIT',
        kind: side,
        margin,
      });

      if (result.status === 200 && result.ok) {
        log(
          `${simUser.username}: ${side} ${qty} @ $${price.toLocaleString()} (order ${orderNum}/${config.ordersPerUser})`,
        );
      } else {
        log(
          `${simUser.username}: order ${orderNum} failed — ${result.msg || 'unknown error'}`,
        );
      }

      if (orderNum < config.ordersPerUser) {
        const delayMs = randomBetween(config.delayMinSec, config.delayMaxSec) * 1000;
        if (delayMs > 0) {
          await sleep(delayMs, signal);
        }
      }
    }
  });

  await Promise.all(tasks);
  log('Load test complete.');
}
