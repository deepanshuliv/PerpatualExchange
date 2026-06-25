import { redisClient, connectRedisClient } from '@repo/redis';
import { WebsocketTypes, type RedisStreamResponse } from '@repo/shared-types';
import { checkMarketUpdateAndSendToSubsribedUser } from '..';

export async function startConsumerGroup() {
  const consumerGroups = redisClient.duplicate();
  await connectRedisClient(consumerGroups, "WebSocketConsumer");

  const streamKey = process.env.BACKEND_STREAM!;
  const groupName = process.env.WS_CONSUMER_GROUP!;
  const consumerName = process.env.WS_CONSUMER_NAME!;

  try {
    await consumerGroups.xGroupCreate(streamKey, groupName, '0', {
      MKSTREAM: true,
    });
  } catch (err: any) {
    if (err.message && err.message.includes("BUSYGROUP")) {
      // Group already exists, ignore
    } else {
      console.error("[WebSocket Consumer] Failed to initialize consumer group:", err);
      process.exit(1);
    }
  }

  // Run the consumer loop in the background
  (async () => {
    while (1) {
      const response = (await consumerGroups.xReadGroup(
        groupName,
        consumerName,
        { key: streamKey, id: '>' },
        { BLOCK: 0, COUNT: 100 },
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
            }
            
            // Always acknowledge the message to remove it from the consumer group
            await consumerGroups.xAck(streamKey, groupName, message.id);
          } catch (e) {
            console.error("[WebSocket Consumer] Error processing message, acknowledging to discard:", e);
            try {
              await consumerGroups.xAck(streamKey, groupName, message.id);
            } catch (ackErr) {
              console.error("[WebSocket Consumer] Failed to ACK failed message:", ackErr);
            }
          }
        }
      }
    }
  })().catch((err) => {
    console.error("WebSocket consumer loop error:", err);
    process.exit(1);
  });
}
