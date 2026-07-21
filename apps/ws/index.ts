import { WS_SUBSCRIBE_SCHEMA } from '@repo/shared-types';
import { WebSocketServer } from 'ws';
import { registerClient, sendCandleSnapshot, unregisterClient } from './src/broadcast';
import { startConsumerGroup } from './src/redis';

async function bootstrap() {
  try {
    await startConsumerGroup();

    const wss = new WebSocketServer({ port: 8080 });

    wss.on('listening', () => {
      console.log('WebSocket server is listening on port 8080');
    });

    wss.on('connection', function connection(ws) {
      ws.on('error', (err) => console.log('[connection] error', err));

      const client = {
        ws,
        subscriptions: new Set<string>(),
      };
      registerClient(client);

      ws.on('message', function message(_data) {
        let parsedData;
        try {
          parsedData = JSON.parse(_data.toString());
        } catch (e) {
          return ws.send(JSON.stringify({ success: false, error: 'Invalid JSON format' }));
        }

        const subscriptionParse = WS_SUBSCRIBE_SCHEMA.safeParse(parsedData);
        if (!subscriptionParse.success) {
          return ws.send(
            JSON.stringify({
              success: false,
              error: 'Please provide valid subscription parameters',
            }),
          );
        }

        const { method, params, id } = subscriptionParse.data;
        const targetId = id || 1;

        if (method === 'SUBSCRIBE') {
          for (const param of params) {
            client.subscriptions.add(param);
            if (param.startsWith('candle.')) {
              sendCandleSnapshot(client, param);
            }
          }
        } else if (method === 'UNSUBSCRIBE') {
          for (const param of params) {
            client.subscriptions.delete(param);
          }
        }

        return ws.send(JSON.stringify({ result: null, id: targetId }));
      });

      ws.on('close', () => {
        unregisterClient(client);
      });
    });
  } catch (error) {
    console.log('[bootstrap] error', error);
    process.exit(1);
  }
}

bootstrap();
