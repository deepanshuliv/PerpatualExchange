import { connectRedisClient, redisClient } from '@repo/redis';
import { WebsocketTypes, type RedisStreamResponse } from '@repo/shared-types';
import { checkMarketUpdateAndSendToSubsribedUser } from './broadcast';

export async function startConsumerGroup() {
  const consumerGroups = redisClient.duplicate();
  await connectRedisClient(consumerGroups, 'WebSocketConsumer');

  const streamKey = process.env.BACKEND_STREAM || 'to-backend';
  const groupName = process.env.WS_CONSUMER_GROUP || 'ws-group';
  const consumerName = process.env.WS_CONSUMER_NAME || `ws-${process.pid}-${Math.random().toString(36).slice(2, 6)}`;

  try {
    await consumerGroups.xGroupCreate(streamKey, groupName, '$', {
      MKSTREAM: true,
    });
    console.log(`[WebSocket Consumer] Created group '${groupName}' at stream tail ($)`);
  } catch (err: any) {
    if (!err.message?.includes('BUSYGROUP')) {
      console.log('[startConsumerGroup] warning during xGroupCreate:', err.message);
    } else {
      console.log(`[WebSocket Consumer] Using existing group '${groupName}'`);
    }
  }

  // Consumer loop
  (async () => {
    while (true) {
      try {
        const response = (await consumerGroups.xReadGroup(
          groupName,
          consumerName,
          [{ key: streamKey, id: '>' }],
          { BLOCK: 1000, COUNT: 100 },
        )) as unknown as RedisStreamResponse;

        if (!response || !Array.isArray(response)) continue;

        for (const stream of response) {
          if (!stream || !Array.isArray(stream.messages)) continue;
          for (const message of stream.messages) {
            try {
              const rawData = message?.message?.data;
              if (rawData) {
                const parsedData = JSON.parse(rawData);
                const parseResult = WebsocketTypes.WsStreamingResponse.safeParse(parsedData);
                if (parseResult.success) {
                  checkMarketUpdateAndSendToSubsribedUser(parseResult.data);
                }
              }
              await consumerGroups.xAck(streamKey, groupName, message.id);
            } catch (e) {
              console.log('[consumerMessage] error processing message:', e);
              try {
                await consumerGroups.xAck(streamKey, groupName, message.id);
              } catch (_) {}
            }
          }
        }
      } catch (loopErr) {
        console.log('[consumerLoop] error:', loopErr);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  })();
}
