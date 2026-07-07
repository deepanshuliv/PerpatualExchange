import { connectRedisClient, redisClient } from '@repo/redis';
import { EngineResponse, type EngineRequest, type RedisStreamResponse } from '@repo/shared-types';

const publisher = redisClient.duplicate();
const subscriber = redisClient.duplicate();

type PendingRequest = {
  resolve: (data: EngineResponse.BACKEND_RESPONSE) => void;
  timer: ReturnType<typeof setTimeout>;
};

const correlationIdToResolveMap = new Map<string, PendingRequest>();

export async function sendToEngine(
  engineRequest: EngineRequest.BACKEND_ENGINE_REQUEST,
): Promise<EngineResponse.BACKEND_RESPONSE> {
  await connectRedisClient(publisher, 'Backend-Publisher');

  const streamKey = process.env.ENGINE_STREAM || 'to-engine';

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      correlationIdToResolveMap.delete(engineRequest.correlationId);
      reject(new Error('Timeout waiting for engine response'));
    }, 10000);

    correlationIdToResolveMap.set(engineRequest.correlationId, { resolve, timer });

    publisher
      .xAdd(streamKey, '*', { data: JSON.stringify(engineRequest) })
      .then((msgId) => {
        console.log(
          `[Backend] Pushed to '${streamKey}': type=${engineRequest.type} | correlationId=${engineRequest.correlationId} | msgId=${msgId}`,
        );
      })
      .catch((err) => {
        const pending = correlationIdToResolveMap.get(engineRequest.correlationId);
        if (pending) {
          clearTimeout(pending.timer);
          correlationIdToResolveMap.delete(engineRequest.correlationId);
        }
        console.log(`[Backend] Failed to push to Redis stream '${streamKey}':`, err);
        reject(err);
      });
  });
}

function handleEngineResponse(rawMessage: unknown) {
  if (typeof rawMessage === 'object' && rawMessage !== null && 'type' in rawMessage) {
    const type = (rawMessage as { type: string }).type;
    if (
      type === 'liquidation' ||
      type === 'markprice_updated' ||
      type === 'depth_updated' ||
      type === 'trade_executed' ||
      type === 'last_traded_price_updated' ||
      type === 'funding_timer_reset'
    ) {
      return;
    }
  }

  const { success, data, error } = EngineResponse.BACKEND_RESPONSE_SCHEMA.safeParse(rawMessage);
  if (!success) {
    console.log('[Backend] Could not parse engine response:', rawMessage, error?.format());
    return;
  }

  console.log(
    `[Backend] Engine response received: type=${data.type} | correlationId=${data.correlationId}`,
  );

  const pending = correlationIdToResolveMap.get(data.correlationId);
  if (!pending) {
    console.log(`[Backend] No pending resolve found for correlationId=${data.correlationId}`);
    return;
  }
  clearTimeout(pending.timer);
  pending.resolve(data);
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
      console.log('[Backend] Error in engineToBackendLoop:', err);
      await new Promise((res) => setTimeout(res, 1000));
    }
  }
}

export async function initializeRedis() {
  await Promise.all([
    connectRedisClient(subscriber, 'Backend-Subscriber'),
    connectRedisClient(publisher, 'Backend-Publisher'),
  ]);

  engineToBackendLoop().catch((err) => {
    console.log('[Backend] Engine loop fatal error:', err);
    process.exit(1);
  });
}
