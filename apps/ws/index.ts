import { EngineResponse, WebsocketTypes } from '@repo/shared-types';
import { WebSocket, WebSocketServer } from 'ws';
import { startConsumerGroup } from './src/redis';

type UserSchema = {
  ws: WebSocket;
  userId: string;
};

type UserSubscribeStore = Record<string, UserSchema[]>;

const store: UserSubscribeStore = {};

const wss = new WebSocketServer({ port: 8080 });

await startConsumerGroup();

wss.on('connection', function connection(ws) {
  ws.on('error', console.error);

  ws.on('message', function message(_data) {
    const { success, data } = WebsocketTypes.WS_REQUEST_SCHEMA.safeParse(_data);
    if (!success) {
      return ws.send(`{success : false , error : "please provide valid fields"}`);
    }

    const { market, type, userId } = data;

    if (type === 'unsubscribe') {
      Object.entries(store).forEach(([availabelMarket, users]) => {
        if (availabelMarket === market) {
          users = users.filter((user) => {
            return user.userId !== userId;
          });
        }
      });

      const msgToSend: WebsocketTypes.marketUnsubscribeType = {
        market: market,
        msg: `subscribed to market ${market}`,
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
    }

    // parse check and add to store
  });
});

type ProcessableEngineMessage = Extract<
  EngineResponse.ENGINE_RESPONSE,
  { type: 'create_order' | 'cancel_order' | 'liquidation' }
>;
export function checkMarketUpdateAndSendToSubsribedUser(update: any) {
  Object.entries(store).forEach(([market, users]) => {
    if (market === update.payload.market) {
      for (const user of users) {
        // TODO: create ws_response
        const dataSent: WebsocketTypes.WebsocketResponse = {
          market: update.market,
          fills: update.fill
        };
        WebsocketTypes.WS_MARKET_UPDATE_RESPONSE_SCHEMA.safeParse();
        user.ws.send(JSON.stringify(update));
      }
    }
  });
}
