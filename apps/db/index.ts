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
  try {
    const pending = await readStream(subscriber, '0', 0);
    if (pending?.[0]?.messages.length) {
      return pending;
    }
  } catch (_) {}

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
      console.log('[startConsumer] warning during xGroupCreate:', err.message);
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
      console.log('[startConsumer] error in batch processing loop:', err);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

async function bootstrap() {
  while (true) {
    try {
      await startConsumer();
    } catch (err) {
      console.log('[DB Consumer] Restarting consumer after error:', err);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

bootstrap();
