import { WebsocketTypes } from '@repo/shared-types';
import type { WebSocket } from 'ws';
import { applyTradeToLiveCandles } from './candleState';

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

type ProcessableEngineMessage = WebsocketTypes.WsStreamingMessage;

export function checkMarketUpdateAndSendToSubsribedUser(update: ProcessableEngineMessage) {
  const executionTime = Date.now();
  const transactionTime = update.payload.transactionTime;

  if (update.type === 'depth_updated') {
    const { market, bids, asks } = update.payload;
    sendToSubscribers(`depth.${market}`, {
      type: 'depth',
      market,
      bids,
      asks,
      transactionTime,
      executionTime,
    });
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
    return;
  }

  if (update.type === 'last_traded_price_updated') {
    const { market, price } = update.payload;
    sendToSubscribers(`lastTradedPrice.${market}`, {
      type: 'lastTradedPrice',
      market,
      price,
      transactionTime,
      executionTime,
    });
    return;
  }

  if (update.type === 'markprice_updated') {
    if (Date.now() - (transactionTime ?? Date.now()) > MAX_MARKPRICE_AGE_MS) return;
    const { market, price } = update.payload;
    sendToSubscribers(`markPrice.${market}`, {
      type: 'markPrice',
      market,
      price,
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
