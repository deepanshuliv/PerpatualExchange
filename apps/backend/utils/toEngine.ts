import { connectRedisClient, redisClient } from '@repo/redis';
import { EngineResponse, type EngineRequest, type RedisStreamResponse } from '@repo/shared-types';

const publisher = redisClient.duplicate();
const subscriber = redisClient.duplicate();

type PendingRequest = {
  resolve: (data: EngineResponse.BACKEND_RESPONSE) => void;
  timer: ReturnType<typeof setTimeout>;
};

const correlationIdToResolveMap = new Map<string, PendingRequest>();

const depthCache: Partial<Record<string, { bids: unknown; asks: unknown }>> = {};
const markPriceCache: Partial<Record<string, number>> = {};

export function getCachedDepth(market: string) {
  return depthCache[market] ?? null;
}

export function getCachedMarkPrice(market: string) {
  return markPriceCache[market] ?? null;
}

function cacheBroadcastMessage(rawMessage: unknown) {
  if (typeof rawMessage !== 'object' || rawMessage === null || !('type' in rawMessage)) {
    return;
  }

  const type = (rawMessage as { type: string }).type;

  if (type === 'depth_updated') {
    const payload = (
      rawMessage as { payload?: { market?: string; bids?: unknown; asks?: unknown } }
    ).payload;
    if (!payload?.market) return;

    depthCache[payload.market] = {
      bids: payload.bids ?? [],
      asks: payload.asks ?? [],
    };
    return;
  }

  if (type === 'markprice_updated') {
    const payload = (rawMessage as { payload?: { market?: string; price?: number | string } })
      .payload;
    const price = Number(payload?.price);
    if (!payload?.market || !Number.isFinite(price) || price <= 0) return;

    markPriceCache[payload.market] = price;
  }
}

async function seedMarketCacheFromStream() {
  const streamKey = process.env.BACKEND_STREAM || 'to-backend';

  try {
    const messages = await subscriber.xRevRange(streamKey, '+', '-', { COUNT: 300 });
    const seededDepth = new Set<string>();
    const seededMark = new Set<string>();

    for (const msg of messages) {
      try {
        const parsed = JSON.parse(msg.message.data ?? '{}');
        const market = parsed.payload?.market;
        if (!market) continue;

        if (parsed.type === 'depth_updated' && !seededDepth.has(market)) {
          cacheBroadcastMessage(parsed);
          seededDepth.add(market);
        }

        if (parsed.type === 'markprice_updated' && !seededMark.has(market)) {
          cacheBroadcastMessage(parsed);
          seededMark.add(market);
        }
      } catch (err) {
        console.log('[seedMarketCacheFromStream] error', err);
      }
    }
  } catch (err) {
    console.log('[seedMarketCacheFromStream] error', err);
  }
}

const ENGINE_RPC_TIMEOUT_MS = 1_000;

export async function sendToEngine(
  engineRequest: EngineRequest.BACKEND_ENGINE_REQUEST,
): Promise<EngineResponse.BACKEND_RESPONSE> {
  await connectRedisClient(publisher, 'Backend-Publisher');

  const streamKey = process.env.ENGINE_STREAM || 'to-engine';

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      correlationIdToResolveMap.delete(engineRequest.correlationId);
      reject(new Error('Timeout waiting for engine response'));
    }, ENGINE_RPC_TIMEOUT_MS);

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
        console.log('[sendToEngine] error', err);
        reject(err);
      });
  });
}

function handleEngineResponse(rawMessage: unknown) {
  cacheBroadcastMessage(rawMessage);

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
    console.log('[handleEngineResponse] error', rawMessage, error?.format());
    return;
  }

  console.log(
    `[Backend] Engine response received: type=${data.type} | correlationId=${data.correlationId}`,
  );

  const pending = correlationIdToResolveMap.get(data.correlationId);
  if (!pending) {
    return;
  }
  clearTimeout(pending.timer);
  pending.resolve(data);
  correlationIdToResolveMap.delete(data.correlationId);
}

async function engineToBackendLoop() {
  await connectRedisClient(subscriber, 'Backend-Subscriber');
  const streamKey = process.env.BACKEND_STREAM || 'to-backend';
  const latest = await subscriber.xRevRange(streamKey, '+', '-', { COUNT: 1 });
  let lastId = latest[0]?.id ?? '$';

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
      console.log('[engineToBackendLoop] error', err);
      await new Promise((res) => setTimeout(res, 1000));
    }
  }
}

export async function initializeRedis() {
  await Promise.all([
    connectRedisClient(subscriber, 'Backend-Subscriber'),
    connectRedisClient(publisher, 'Backend-Publisher'),
  ]);

  await seedMarketCacheFromStream();

  engineToBackendLoop().catch((err) => {
    console.log('[initializeRedis] error', err);
    process.exit(1);
  });
}
