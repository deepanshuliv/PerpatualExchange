import { connectRedisClient, redisClient } from '@repo/redis';
import { WebsocketTypes, type RedisStreamResponse } from '@repo/shared-types';
import { checkMarketUpdateAndSendToSubsribedUser } from './broadcast';

export async function startConsumerGroup() {
  const consumerGroups = redisClient.duplicate();
  await connectRedisClient(consumerGroups, 'WebSocketConsumer');

  const streamKey = process.env.BACKEND_STREAM || 'to-backend';
  const groupName = process.env.WS_CONSUMER_GROUP || 'ws-group';
  const consumerName = process.env.WS_CONSUMER_NAME || 'ws';

  try {
    await consumerGroups.xGroupCreate(streamKey, groupName, '$', {
      MKSTREAM: true,
    });
    console.log(`[WebSocket Consumer] Created group '${groupName}' at stream tail ($)`);
  } catch (err: any) {
    if (!err.message?.includes('BUSYGROUP')) {
      console.log('[WebSocket Consumer] Failed to initialize consumer group:', err);
      process.exit(1);
    }
    console.log(`[WebSocket Consumer] Using existing group '${groupName}'`);
  }

  (async () => {
    while (1) {
      const response = (await consumerGroups.xReadGroup(
        groupName,
        consumerName,
        { key: streamKey, id: '>' },
        { BLOCK: 1000, COUNT: 0 },
      )) as unknown as RedisStreamResponse;
      if (!response) continue;
      if (!Array.isArray(response)) continue;

      for (const stream of response) {
        if (!stream) continue;
        for (const message of stream.messages) {
          try {
            const parsedData = JSON.parse(message.message.data ?? '{}');
            const parseResult = WebsocketTypes.WsStreamingResponse.safeParse(parsedData);

            if (parseResult.success) {
              checkMarketUpdateAndSendToSubsribedUser(parseResult.data);
            } else {
              console.log(
                '[WebSocket Consumer] Skipping unhandled engine message:',
                parsedData?.type ?? 'unknown',
                parseResult.error.issues[0]?.message,
              );
            }

            await consumerGroups.xAck(streamKey, groupName, message.id);
          } catch (e) {
            console.log(
              '[WebSocket Consumer] Error processing message, acknowledging to discard:',
              e,
            );
            try {
              await consumerGroups.xAck(streamKey, groupName, message.id);
            } catch (ackErr) {
              console.log('[WebSocket Consumer] Failed to ACK failed message:', ackErr);
            }
          }
        }
      }
    }
  })().catch((err) => {
    console.log('WebSocket consumer loop error:', err);
    process.exit(1);
  });
}
