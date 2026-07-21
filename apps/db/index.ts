import { connectRedisClient, redisClient } from '@repo/redis';
import { type RedisStreamResponse } from '@repo/shared-types';
import { processMessageBatch } from './src/batchProcessor';

const CONSUMER_GROUP = process.env.DB_CONSUMER_GROUP || 'db-consumer-group';
const CONSUMER_NAME = process.env.DB_CONSUMER_NAME || 'db-consumer';
const STREAM_KEY = process.env.BACKEND_STREAM || 'to-backend';
const BATCH_SIZE = 1000;

async function readBatch(
  subscriber: ReturnType<typeof redisClient.duplicate>,
): Promise<RedisStreamResponse> {
  let response = (await subscriber.xReadGroup(
    CONSUMER_GROUP,
    CONSUMER_NAME,
    [{ key: STREAM_KEY, id: '0' }],
    { COUNT: BATCH_SIZE, BLOCK: 0 },
  )) as unknown as RedisStreamResponse;

  if (!response || response.length === 0 || response[0]!.messages.length === 0) {
    response = (await subscriber.xReadGroup(
      CONSUMER_GROUP,
      CONSUMER_NAME,
      [{ key: STREAM_KEY, id: '>' }],
      { COUNT: BATCH_SIZE, BLOCK: 1000 },
    )) as unknown as RedisStreamResponse;
  }

  return response;
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
          console.log('[processMessageBatch] error', txError);
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    } catch (loopError) {
      console.log('[startConsumer] error', loopError);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

startConsumer().catch((err) => {
  console.log('[startConsumer] error', err);
  process.exit(1);
});
