import { WebsocketTypes } from '@repo/shared-types';
import type { WebSocket } from 'ws';
import { applyTradeToLiveCandles, getCandleSeries } from './candleState';

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

function broadcastCandle(
  market: string,
  interval: '1m' | '5m' | '15m' | '1h' | '1d',
  candle: ReturnType<typeof applyTradeToLiveCandles>['candle1h'],
  transactionTime: number,
  executionTime: number,
) {
  sendToSubscribers(`candle.${market}.${interval}`, {
    type: 'candle',
    interval,
    market,
    openTime: candle.openTime,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
    transactionTime,
    executionTime,
  });
}

export function sendCandleSnapshot(client: { ws: WebSocket }, stream: string) {
  const match = stream.match(/^candle\.([^.]+)\.(1m|5m|15m|1h|1d)$/);
  if (!match) return;

  const [, market, interval] = match;
  const candles = getCandleSeries(market!, interval as '1m' | '5m' | '15m' | '1h' | '1d');
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

type EngineEvent = WebsocketTypes.WsStreamingMessage;

// The WS service is a thin relay: every engine event is forwarded as-is to the
// clients subscribed to its stream. The only derived data is candles, which are
// built from real executed trades.
export function checkMarketUpdateAndSendToSubsribedUser(update: EngineEvent) {
  const executionTime = Date.now();
  const transactionTime = update.payload.transactionTime;

  switch (update.type) {
    case 'depth_updated': {
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

    case 'trade_executed': {
      const { market, price, qty } = update.payload;
      sendToSubscribers(`trade.${market}`, {
        type: 'trade',
        market,
        price,
        qty,
        transactionTime,
        executionTime,
      });

      const { candle1m, candle5m, candle15m, candle1h, candle1d } = applyTradeToLiveCandles(market, price, qty, transactionTime);
      broadcastCandle(market, '1m', candle1m, transactionTime, executionTime);
      broadcastCandle(market, '5m', candle5m, transactionTime, executionTime);
      broadcastCandle(market, '15m', candle15m, transactionTime, executionTime);
      broadcastCandle(market, '1h', candle1h, transactionTime, executionTime);
      broadcastCandle(market, '1d', candle1d, transactionTime, executionTime);
      return;
    }

    case 'last_traded_price_updated': {
      const { market, price } = update.payload;
      sendToSubscribers(`lastTradedPrice.${market}`, {
        type: 'lastTradedPrice',
        market,
        price: Number(price),
        transactionTime,
        executionTime,
      });
      return;
    }

    case 'markprice_updated': {
      const { market, price } = update.payload;
      sendToSubscribers(`markPrice.${market}`, {
        type: 'markPrice',
        market,
        price: Number(price),
        transactionTime,
        executionTime,
      });
      return;
    }

    case 'funding_timer_reset': {
      const { market } = update.payload;
      sendToSubscribers(`funding.${market}`, {
        type: 'fundingTimerReset',
        market,
        transactionTime,
        executionTime,
      });
      return;
    }

    case 'liquidation': {
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
      return;
    }
  }
}
