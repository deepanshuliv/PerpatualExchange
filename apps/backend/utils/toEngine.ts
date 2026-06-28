import { connectRedisClient, redisClient } from '@repo/redis';
import { EngineResponse, type EngineRequest, type RedisStreamResponse } from '@repo/shared-types';

const publisher = redisClient.duplicate();
const subscriber = redisClient.duplicate();

const correlationIdToResolveMap = new Map<string, (data: EngineResponse.BACKEND_RESPONSE) => void>();

export async function sendToEngine(
  engineRequest: EngineRequest.BACKEND_ENGINE_REQUEST,
): Promise<EngineResponse.BACKEND_RESPONSE> {
  await connectRedisClient(publisher, 'Backend-Publisher');

  const streamKey = process.env.ENGINE_STREAM! || 'to-engine';

  return new Promise((resolve, reject) => {
    correlationIdToResolveMap.set(engineRequest.correlationId, resolve);
    console.log('map', correlationIdToResolveMap);
    const timer = setTimeout(() => {
      correlationIdToResolveMap.delete(engineRequest.correlationId);
      reject(new Error('Timeout waiting for engine response'));
    }, 10000);

    publisher
      .xAdd(streamKey, '*', { data: JSON.stringify(engineRequest) })
      .then((msgId) => {
        console.log(
          `[Backend] Pushed to '${streamKey}': type=${engineRequest.type} | correlationId=${engineRequest.correlationId} | msgId=${msgId}`,
        );
      })
      .catch((err) => {
        clearTimeout(timer);
        correlationIdToResolveMap.delete(engineRequest.correlationId);
        console.error(`[Backend] Failed to push to Redis stream '${streamKey}':`, err);
        reject(err);
      });
  });
}


// give a look
function handleEngineResponse(rawMessage: unknown) {
  if (typeof rawMessage === 'object' && rawMessage !== null && 'type' in rawMessage) {
    const type = (rawMessage as { type: string }).type;
    if (type === 'liquidation' || type === 'markprice_updated' || type === 'bookticker_updated') {
      return;
    }
  }

  const { success, data, error } = EngineResponse.BACKEND_RESPONSE_SCHEMA.safeParse(rawMessage);
  if (!success) {
    console.error('[Backend] Could not parse engine response:', rawMessage, error?.format());
    return;
  }

  console.log(
    `[Backend] Engine response received: type=${data.type} | correlationId=${data.correlationId}`,
  );

  const resolve = correlationIdToResolveMap.get(data.correlationId);
  if (!resolve) {
    console.warn(`[Backend] No pending resolve found for correlationId=${data.correlationId}`);
    return;
  }
  resolve(data);
  correlationIdToResolveMap.delete(data.correlationId);
}

async function engineToBackendLoop() {
  await connectRedisClient(subscriber, 'Backend-Subscriber');
  const streamKey = process.env.BACKEND_STREAM || 'to-backend';
  let lastId = '$';

  while (1) {
    try {
      const response = (await subscriber.xRead([{ key: streamKey, id: lastId }], {
        COUNT: 100,
        BLOCK: 0,
      })) as RedisStreamResponse;

      if (!response || !Array.isArray(response)) {
        continue;
      }

      for (const stream of response) {
        for (const msg of stream.messages) {
          lastId = msg.id;
          const parsedMessage = JSON.parse(msg.message.data!);
          handleEngineResponse(parsedMessage);
        }
      }
    } catch (err) {
      console.error('[Backend] Error in engineToBackendLoop:', err);
      await new Promise((res) => setTimeout(res, 1000));
    }
  }
}

export async function initializeRedis() {
  await Promise.all([
    connectRedisClient(subscriber, 'Backend-Subscriber'),
    connectRedisClient(publisher, 'Backend-Publisher'),
  ]);

  // Run the read loop in the background
  engineToBackendLoop().catch((err) => {
    console.error('[Backend] Engine loop fatal error:', err);
    process.exit(1);
  });
}
