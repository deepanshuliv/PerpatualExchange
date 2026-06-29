import { WebsocketTypes } from '@repo/shared-types';
import type { WebSocket } from 'ws';

interface ClientConnection {
  ws: WebSocket;
  subscriptions: Set<string>;
}

const activeClients = new Set<ClientConnection>();

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

/** Mark price ticks are high-frequency; drop stale ones on backlog drain. */
const MAX_MARKPRICE_AGE_MS = 5_000;

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
  } else if (update.type === 'trade_executed') {
    const { market, price, qty } = update.payload;
    sendToSubscribers(`trade.${market}`, {
      type: 'trade',
      market,
      price,
      qty,
      transactionTime,
      executionTime,
    });
  } else if (update.type === 'last_traded_price_updated') {
    const { market, price } = update.payload;
    sendToSubscribers(`lastTradedPrice.${market}`, {
      type: 'lastTradedPrice',
      market,
      price,
      transactionTime,
      executionTime,
    });
  } else if (update.type === 'markprice_updated') {
    if (Date.now() - transactionTime > MAX_MARKPRICE_AGE_MS) return;
    const { market, price } = update.payload;
    sendToSubscribers(`markPrice.${market}`, {
      type: 'markPrice',
      market,
      price,
      transactionTime,
      executionTime,
    });
  } else if (update.type === 'funding_timer_reset') {
    const { market } = update.payload;
    sendToSubscribers(`funding.${market}`, {
      type: 'fundingTimerReset',
      market,
      transactionTime,
      executionTime,
    });
  }
}
