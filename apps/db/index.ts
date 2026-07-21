import { connectRedisClient, redisClient } from '@repo/redis';
import { type RedisStreamResponse } from '@repo/shared-types';
import { processMessageBatch } from './src/batchProcessor';

const CONSUMER_GROUP = process.env.DB_CONSUMER_GROUP || 'db-consumer-group';
const CONSUMER_NAME = process.env.DB_CONSUMER_NAME || 'db-consumer';
const STREAM_KEY = process.env.BACKEND_STREAM || 'to-backend';
const BATCH_SIZE = 1000;

function readStream(
  subscriber: ReturnType<typeof redisClient.duplicate>,
  id: string,
  blockMs: number,
): Promise<RedisStreamResponse> {
  return subscriber.xReadGroup(CONSUMER_GROUP, CONSUMER_NAME, [{ key: STREAM_KEY, id }], {
    COUNT: BATCH_SIZE,
    BLOCK: blockMs,
  }) as unknown as Promise<RedisStreamResponse>;
}

async function readBatch(
  subscriber: ReturnType<typeof redisClient.duplicate>,
): Promise<RedisStreamResponse> {
  // First drain messages this consumer already received but never acked (e.g.
  // after a crash). '0' reads that pending list. Once it's empty, '>' blocks
  // briefly for brand-new messages.
  const pending = await readStream(subscriber, '0', 0);
  if (pending?.[0]?.messages.length) {
    return pending;
  }

  return readStream(subscriber, '>', 1000);
}

async function startConsumer() {
  const subscriber = redisClient.duplicate();
  await connectRedisClient(subscriber, 'DBConsumer');

  try {
    await subscriber.xGroupCreate(STREAM_KEY, CONSUMER_GROUP, '0', {
      MKSTREAM: true,
    });
    console.log(`[DB Consumer] Created group '${CONSUMER_GROUP}'`);
  } catch (err: any) {
    if (!err.message?.includes('BUSYGROUP')) {
      console.log('[startConsumer] error', err);
      process.exit(1);
    }
  }

  while (true) {
    try {
      const response = await readBatch(subscriber);
      const messages = response?.[0]?.messages ?? [];

      if (messages.length === 0) {
        continue;
      }

      const { ackIds, invalidIds } = await processMessageBatch(messages);

      const allAckIds = [...ackIds, ...invalidIds];
      if (allAckIds.length > 0) {
        await subscriber.xAck(STREAM_KEY, CONSUMER_GROUP, allAckIds);
      }
    } catch (err) {
      console.log('[startConsumer] error', err);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

startConsumer().catch((err) => {
  console.log('[startConsumer] error', err);
  process.exit(1);
});
