import { redisClient, connectRedisClient, type RedisClientType } from '@repo/redis';
import { WebsocketTypes, type RedisStreamResponse } from '@repo/shared-types';
import { checkMarketUpdateAndSendToSubsribedUser } from './broadcast';

export async function startConsumerGroup() {
  const consumerGroups = redisClient.duplicate();
  await connectRedisClient(consumerGroups, 'WebSocketConsumer');

  const streamKey = process.env.BACKEND_STREAM!;
  const groupName = process.env.WS_CONSUMER_GROUP!;
  const consumerName = process.env.WS_CONSUMER_NAME!;

  try {
    // '$' = only messages added after group creation (not full stream history)
    await consumerGroups.xGroupCreate(streamKey, groupName, '$', {
      MKSTREAM: true,
    });
    console.log(`[WebSocket Consumer] Created group '${groupName}' at stream tail ($)`);
  } catch (err: any) {
    if (err.message && err.message.includes('BUSYGROUP')) {
      // Group already exists — skip any backlog and pending replay on restart
      await consumerGroups.sendCommand(['XGROUP', 'SETID', streamKey, groupName, '$']);
      console.log(`[WebSocket Consumer] Group '${groupName}' reset to stream tail ($)`);
    } else {
      console.error('[WebSocket Consumer] Failed to initialize consumer group:', err);
      process.exit(1);
    }
  }

  // Ack stale pending entries without broadcasting (crash recovery leftovers)
  await drainPendingMessages(consumerGroups, streamKey, groupName, consumerName);

  (async () => {
    while (1) {
      const response = (await consumerGroups.xReadGroup(
        groupName,
        consumerName,
        { key: streamKey, id: '>' },
        { BLOCK: 1000, COUNT: 100 },
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
              console.warn(
                '[WebSocket Consumer] Skipping unhandled engine message:',
                parsedData?.type ?? 'unknown',
                parseResult.error.issues[0]?.message,
              );
            }

            await consumerGroups.xAck(streamKey, groupName, message.id);
          } catch (e) {
            console.error(
              '[WebSocket Consumer] Error processing message, acknowledging to discard:',
              e,
            );
            try {
              await consumerGroups.xAck(streamKey, groupName, message.id);
            } catch (ackErr) {
              console.error('[WebSocket Consumer] Failed to ACK failed message:', ackErr);
            }
          }
        }
      }
    }
  })().catch((err) => {
    console.error('WebSocket consumer loop error:', err);
    process.exit(1);
  });
}

async function drainPendingMessages(
  client: RedisClientType,
  streamKey: string,
  groupName: string,
  consumerName: string,
) {
  let drained = 0;
  while (true) {
    const response = (await client.xReadGroup(
      groupName,
      consumerName,
      { key: streamKey, id: '0' },
      { BLOCK: 0, COUNT: 100 },
    )) as unknown as RedisStreamResponse;

    if (!response || !Array.isArray(response) || !response[0]?.messages?.length) {
      break;
    }

    for (const message of response[0].messages) {
      await client.xAck(streamKey, groupName, message.id);
      drained++;
    }
  }

  if (drained > 0) {
    console.log(`[WebSocket Consumer] Drained ${drained} stale pending message(s) without broadcast`);
  }
}
