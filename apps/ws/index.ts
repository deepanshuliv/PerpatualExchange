import { EngineResponse, WebsocketTypes } from '@repo/shared-types';
import { WebSocket, WebSocketServer } from 'ws';
import { startConsumerGroup } from './src/redis';

type UserSchema = {
  ws: WebSocket;
  userId: string;
};

type UserSubscribeStore = Record<string, UserSchema[]>;

const store: UserSubscribeStore = {};

async function bootstrap() {
  try {
    console.log("Connecting WS to Redis...");
    await startConsumerGroup();
    console.log("Redis connected. Starting WebSocket server...");

    const wss = new WebSocketServer({ port: 8080 });

    wss.on('listening', () => {
      console.log('WebSocket server is listening on port 8080');
    });

    wss.on('connection', function connection(ws) {
  ws.on('error', console.error);

  ws.on('message', function message(_data) {
    let parsedData;
    try {
      parsedData = JSON.parse(_data.toString());
    } catch (e) {
      return ws.send(JSON.stringify({ success: false, error: "Invalid JSON format" }));
    }

    const { success, data } = WebsocketTypes.WS_REQUEST_SCHEMA.safeParse(parsedData);
    if (!success) {
      return ws.send(JSON.stringify({ success: false, error: "please provide valid fields" }));
    }

    const { market, type, userId } = data;

    if (type === 'unsubscribe') {
      if (store[market]) {
        store[market] = store[market].filter((user) => user.userId !== userId);
      }

      const msgToSend: WebsocketTypes.marketUnsubscribeType = {
        market: market,
        msg: `unsubscribed from market ${market}`,
        success: true,
        type: 'unsubscribed',
      };
      ws.send(JSON.stringify(msgToSend));
    } else if (type === 'subscribe') {
      if (!store[market]) {
        store[market] = [];
      }
      store[market]?.push({
        userId,
        ws,
      });

      const msgToSend: WebsocketTypes.marketSubscribeType = {
        market: market,
        msg: `subscribed to market ${market}`,
        success: true,
        type: 'subscribed',
      };
      ws.send(JSON.stringify(msgToSend));
    }
  });

  // Clean up subscriptions when client disconnects to prevent memory leaks
  ws.on('close', () => {
    Object.keys(store).forEach((market) => {
      if (store[market]) {
        store[market] = store[market].filter((user) => user.ws !== ws);
      }
    });
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
  { type: 'create_order' | 'cancel_order' | 'liquidation' }
>;

export function checkMarketUpdateAndSendToSubsribedUser(update: ProcessableEngineMessage) {
  const fills =
    update.type === 'cancel_order'
      ? [{ price: update.payload.price, qty: update.payload.totalQty - update.payload.filledQty }]
      : update.payload.fills;

  const dataSent: WebsocketTypes.WebsocketResponse = {
    market: update.payload.market,
    kind: update.payload.kind,
    side: update.payload.kind === 'LONG' ? 'bids' : 'asks',
    fills,
  };

  Object.entries(store).forEach(([market, users]) => {
    if (market === update.payload.market) {
      for (const user of users) {
        user.ws.send(JSON.stringify(dataSent));
      }
    }
  });
}

