import { WebsocketTypes } from '@repo/shared-types';
import type { WebSocket } from 'ws';
import {
  applyTradeToLiveCandles,
  getCandleSeries,
  getLastDepth,
  getLastMarkPrice,
  midPriceFromDepth,
  rememberDepth,
  rememberMarkPrice,
  sampleOrderbookMids,
} from './candleState';

interface ClientConnection {
  ws: WebSocket;
  subscriptions: Set<string>;
}

const activeClients = new Set<ClientConnection>();
const MAX_MARKPRICE_AGE_MS = 5_000;

export function registerClient(client: ClientConnection) {
  activeClients.add(client);
}

export function unregisterClient(client: ClientConnection) {
  activeClients.delete(client);
}

function sendToSubscribers(stream: string, data: Record<string, unknown>) {
  const message = JSON.stringify({ stream, data });
  for (const client of activeClients) {
    if (client.subscriptions.has(stream)) {
      client.ws.send(message);
    }
  }
}

function broadcastCandles(
  market: string,
  candle1h: ReturnType<typeof applyTradeToLiveCandles>['candle1h'],
  candle1d: ReturnType<typeof applyTradeToLiveCandles>['candle1d'],
  transactionTime: number,
  executionTime: number,
) {
  sendToSubscribers(`candle.${market}.1h`, {
    type: 'candle',
    interval: '1h',
    market,
    openTime: candle1h.openTime,
    open: candle1h.open,
    high: candle1h.high,
    low: candle1h.low,
    close: candle1h.close,
    volume: candle1h.volume,
    transactionTime,
    executionTime,
  });

  sendToSubscribers(`candle.${market}.1d`, {
    type: 'candle',
    interval: '1d',
    market,
    openTime: candle1d.openTime,
    open: candle1d.open,
    high: candle1d.high,
    low: candle1d.low,
    close: candle1d.close,
    volume: candle1d.volume,
    transactionTime,
    executionTime,
  });
}

export function sendMarkPriceSnapshot(client: { ws: WebSocket }, stream: string) {
  const match = stream.match(/^markPrice\.([^.]+)$/);
  if (!match) return;

  const market = match[1]!;
  const price = getLastMarkPrice(market);
  if (!price) return;

  const executionTime = Date.now();
  client.ws.send(
    JSON.stringify({
      stream,
      data: {
        type: 'markPrice',
        market,
        price,
        transactionTime: executionTime,
        executionTime,
      },
    }),
  );
}

export function sendDepthSnapshot(client: { ws: WebSocket }, stream: string) {
  const match = stream.match(/^depth\.([^.]+)$/);
  if (!match) return;

  const market = match[1]!;
  const depth = getLastDepth(market);
  if (!depth) return;

  const executionTime = Date.now();
  client.ws.send(
    JSON.stringify({
      stream,
      data: {
        type: 'depth',
        market,
        bids: depth.bids,
        asks: depth.asks,
        transactionTime: executionTime,
        executionTime,
      },
    }),
  );
}

export function sendCandleSnapshot(client: { ws: WebSocket }, stream: string) {
  const match = stream.match(/^candle\.([^.]+)\.(1h|1d)$/);
  if (!match) return;

  const [, market, interval] = match;
  const candles = getCandleSeries(market!, interval as '1h' | '1d');
  if (candles.length === 0) return;

  client.ws.send(
    JSON.stringify({
      stream,
      data: {
        type: 'candle_snapshot',
        interval,
        market,
        candles,
      },
    }),
  );
}

export function startOrderbookCandleSampler() {
  setInterval(() => {
    const executionTime = Date.now();
    for (const { market, price, transactionTime } of sampleOrderbookMids()) {
      const { candle1h, candle1d } = applyTradeToLiveCandles(market, price, 0, transactionTime);
      broadcastCandles(market, candle1h, candle1d, transactionTime, executionTime);
    }
  }, 5_000);
}

type ProcessableEngineMessage = WebsocketTypes.WsStreamingMessage;

export function checkMarketUpdateAndSendToSubsribedUser(update: ProcessableEngineMessage) {
  const executionTime = Date.now();
  const transactionTime = update.payload.transactionTime;

  if (update.type === 'depth_updated') {
    const { market, bids, asks } = update.payload;
    rememberDepth(market, bids, asks);

    sendToSubscribers(`depth.${market}`, {
      type: 'depth',
      market,
      bids,
      asks,
      transactionTime,
      executionTime,
    });

    const midPrice = midPriceFromDepth(bids, asks);
    if (midPrice) {
      const { candle1h, candle1d } = applyTradeToLiveCandles(
        market,
        midPrice,
        0,
        transactionTime,
      );
      broadcastCandles(market, candle1h, candle1d, transactionTime, executionTime);
    }
    return;
  }

  if (update.type === 'trade_executed') {
    const { market, price, qty } = update.payload;

    sendToSubscribers(`trade.${market}`, {
      type: 'trade',
      market,
      price,
      qty,
      transactionTime,
      executionTime,
    });

    const { candle1h, candle1d } = applyTradeToLiveCandles(market, price, qty, transactionTime);
    broadcastCandles(market, candle1h, candle1d, transactionTime, executionTime);
    return;
  }

  if (update.type === 'last_traded_price_updated') {
    const { market, price } = update.payload;
    const numericPrice = Number(price);
    sendToSubscribers(`lastTradedPrice.${market}`, {
      type: 'lastTradedPrice',
      market,
      price: numericPrice,
      transactionTime,
      executionTime,
    });

    if (Number.isFinite(numericPrice) && numericPrice > 0) {
      const { candle1h, candle1d } = applyTradeToLiveCandles(
        market,
        numericPrice,
        0,
        transactionTime,
      );
      broadcastCandles(market, candle1h, candle1d, transactionTime, executionTime);
    }
    return;
  }

  if (update.type === 'markprice_updated') {
    const { market, price } = update.payload;
    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) return;

    rememberMarkPrice(market, numericPrice);
    if (Date.now() - (transactionTime ?? Date.now()) > MAX_MARKPRICE_AGE_MS) return;

    sendToSubscribers(`markPrice.${market}`, {
      type: 'markPrice',
      market,
      price: numericPrice,
      transactionTime,
      executionTime,
    });
    return;
  }

  if (update.type === 'funding_timer_reset') {
    const { market } = update.payload;
    sendToSubscribers(`funding.${market}`, {
      type: 'fundingTimerReset',
      market,
      transactionTime,
      executionTime,
    });
    return;
  }

  if (update.type === 'liquidation') {
    const { market, userId, kind, filledQty, totalQty, totalSpent } = update.payload;
    const avgPrice = totalQty > 0 ? totalSpent / totalQty : 0;
    sendToSubscribers(`liquidation.${market}`, {
      type: 'liquidation',
      market,
      userId,
      kind,
      price: avgPrice,
      qty: filledQty,
      totalQty,
      transactionTime,
      executionTime,
    });
  }
}
