import { EngineResponse, WebsocketTypes, WS_SUBSCRIBE_SCHEMA } from '@repo/shared-types';
import { WebSocket, WebSocketServer } from 'ws';
import { startConsumerGroup } from './src/redis';

interface ClientConnection {
  ws: WebSocket;
  subscriptions: Set<string>;
}

const activeClients = new Set<ClientConnection>();

async function bootstrap() {
  try {
    await startConsumerGroup();

    const wss = new WebSocketServer({ port: 8080 });

    wss.on('listening', () => {
      console.log('WebSocket server is listening on port 8080');
    });

    wss.on('connection', function connection(ws) {
      ws.on('error', console.error);

      const client: ClientConnection = {
        ws,
        subscriptions: new Set<string>(),
      };
      activeClients.add(client);

      ws.on('message', function message(_data) {
        let parsedData;
        try {
          parsedData = JSON.parse(_data.toString());
        } catch (e) {
          return ws.send(JSON.stringify({ success: false, error: "Invalid JSON format" }));
        }

        // Validate standard subscription request
        const subscriptionParse = WS_SUBSCRIBE_SCHEMA.safeParse(parsedData);
        if (!subscriptionParse.success) {
          return ws.send(JSON.stringify({ success: false, error: "Please provide valid subscription parameters" }));
        }

        const { method, params, id } = subscriptionParse.data;
        const targetId = id || 1;

        if (method === 'SUBSCRIBE') {
          for (const param of params) {
            client.subscriptions.add(param);
          }
        } else if (method === 'UNSUBSCRIBE') {
          for (const param of params) {
            client.subscriptions.delete(param);
          }
        }

        return ws.send(JSON.stringify({
          result: null,
          id: targetId,
        }));
      });

      ws.on('close', () => {
        activeClients.delete(client);
      });
    });

  } catch (error) {
    console.error("Failed to start WS server:", error);
    process.exit(1);
  }
}

bootstrap();

type ProcessableEngineMessage = Extract<
  EngineResponse.ENGINE_RESPONSE,
  {
    type:
      | 'create_order'
      | 'cancel_order'
      | 'liquidation'
      | 'markprice_updated'
      | 'bookticker_updated';
  }
>;

export function checkMarketUpdateAndSendToSubsribedUser(update: ProcessableEngineMessage) {
  const transactionTime = update.payload.transactionTime;
  const executionTime = Date.now();

  if (update.type === 'create_order' || update.type === 'cancel_order' || update.type === 'liquidation') {
    const market = update.payload.market;

    const fills =
      update.type === 'cancel_order'
        ? [{ price: update.payload.price, qty: update.payload.totalQty - update.payload.filledQty }]
        : update.payload.fills;

    const depthMsg = {
      stream: `depth.${market}`,
      data: {
        type: 'depth',
        market,
        kind: update.payload.kind,
        side: update.payload.kind === 'LONG' ? 'bids' : 'asks',
        fills,
        transactionTime,
        executionTime,
      },
    };

    const tradeMessages: Array<{ stream: string; data: any }> = [];
    const actualFills = (update.type === 'create_order' || update.type === 'liquidation') ? (update.payload.fills || []) : [];
    
    for (const fill of actualFills) {
      tradeMessages.push({
        stream: `trade.${market}`,
        data: {
          type: 'trade',
          market,
          price: fill.price,
          qty: fill.qty,
          transactionTime,
          executionTime,
        },
      });
    }

    let lastTradedPriceMsg: any = null;
    const lastFill = actualFills[actualFills.length - 1];
    if (lastFill) {
      lastTradedPriceMsg = {
        stream: `lastTradedPrice.${market}`,
        data: {
          type: 'lastTradedPrice',
          market,
          price: lastFill.price,
          transactionTime,
          executionTime,
        },
      };
    }

    for (const client of activeClients) {
      if (client.subscriptions.has(`depth.${market}`)) {
        client.ws.send(JSON.stringify(depthMsg));
      }
      if (client.subscriptions.has(`trade.${market}`)) {
        for (const t of tradeMessages) {
          client.ws.send(JSON.stringify(t));
        }
      }
      if (lastTradedPriceMsg && client.subscriptions.has(`lastTradedPrice.${market}`)) {
        client.ws.send(JSON.stringify(lastTradedPriceMsg));
      }
    }
  } else if (update.type === 'markprice_updated') {
    const { market, price } = update.payload;
    const markPriceMsg = {
      stream: `markPrice.${market}`,
      data: {
        type: 'markPrice',
        market,
        price,
        transactionTime,
        executionTime,
      },
    };

    for (const client of activeClients) {
      if (client.subscriptions.has(`markPrice.${market}`)) {
        client.ws.send(JSON.stringify(markPriceMsg));
      }
    }
  } else if (update.type === 'bookticker_updated') {
    const { market, bestBidPrice, bestBidQty, bestAskPrice, bestAskQty } = update.payload;
    const bookTickerMsg = {
      stream: `bookTicker.${market}`,
      data: {
        type: 'bookTicker',
        market,
        bestBidPrice,
        bestBidQty,
        bestAskPrice,
        bestAskQty,
        transactionTime,
        executionTime,
      },
    };

    for (const client of activeClients) {
      if (client.subscriptions.has(`bookTicker.${market}`)) {
        client.ws.send(JSON.stringify(bookTickerMsg));
      }
    }
  }
}

