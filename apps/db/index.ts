import { connectRedisClient, redisClient } from '@repo/redis';
import { type RedisStreamResponse } from '@repo/shared-types';
import crypto from 'crypto';
import { processMessageBatch } from './src/batchProcessor';

const CONSUMER_GROUP = process.env.DB_CONSUMER_GROUP || 'db-consumer-group';
const STREAM_KEY = process.env.BACKEND_STREAM || 'to-backend';
const BATCH_SIZE = 1000;

async function readBatch(
  subscriber: ReturnType<typeof redisClient.duplicate>,
  consumerName: string,
): Promise<RedisStreamResponse> {
  let response = (await subscriber.xReadGroup(
    CONSUMER_GROUP,
    consumerName,
    [{ key: STREAM_KEY, id: '0' }],
    { COUNT: BATCH_SIZE, BLOCK: 0 },
  )) as unknown as RedisStreamResponse;

  if (!response || response.length === 0 || response[0]!.messages.length === 0) {
    response = (await subscriber.xReadGroup(
      CONSUMER_GROUP,
      consumerName,
      [{ key: STREAM_KEY, id: '>' }],
      { COUNT: BATCH_SIZE, BLOCK: 1000 },
    )) as unknown as RedisStreamResponse;
  }

  return response;
}

async function startConsumerWorker(consumerName: string) {
  const subscriber = redisClient.duplicate();
  await connectRedisClient(subscriber, `DBConsumer-${consumerName}`);

  try {
    await subscriber.xGroupCreate(STREAM_KEY, CONSUMER_GROUP, '0', {
      MKSTREAM: true,
    });
    console.log(`[DB Consumer Worker - ${consumerName}] Created group '${CONSUMER_GROUP}'`);
  } catch (err: any) {
    if (!err.message?.includes('BUSYGROUP')) {
      console.log(
        `[DB Consumer Worker - ${consumerName}] Failed to initialize consumer group:`,
        err,
      );
      process.exit(1);
    }
  }

  while (true) {
    try {
      const response = await readBatch(subscriber, consumerName);

      if (!response || response.length === 0) {
        continue;
      }

      for (const stream of response) {
        if (stream.messages.length === 0) continue;

        try {
          const { ackIds, invalidIds } = await processMessageBatch(stream.messages);

          const allAckIds = [...ackIds, ...invalidIds];
          if (allAckIds.length > 0) {
            await subscriber.xAck(STREAM_KEY, CONSUMER_GROUP, allAckIds);
          }
        } catch (txError) {
          console.log(
            `[DB Consumer Worker - ${consumerName}] Transaction failed for batch. Retrying whole batch. Error:`,
            txError,
          );
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    } catch (loopError) {
      console.log(`[DB Consumer Worker - ${consumerName}] Error in consumer loop:`, loopError);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

async function startMultiConsumer() {
  const CONCURRENCY = parseInt(process.env.CONCURRENCY || '3');
  const instanceId = crypto.randomBytes(3).toString('hex');

  const workers = [];
  for (let i = 1; i <= CONCURRENCY; i++) {
    const workerName = `db-worker-${instanceId}-${i}`;
    workers.push(startConsumerWorker(workerName));
  }

  await Promise.all(workers);
}

startMultiConsumer().catch((err) => {
  console.log('[DB Consumer] Unhandled consumer startup error:', err);
  process.exit(1);
});
