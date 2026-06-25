import { EngineResponse, type EngineRequest, type RedisStreamResponse } from "@repo/shared-types"
import { connectRedisClient, redisClient } from "@repo/redis"

const publisher = redisClient.duplicate();
const subscriber = redisClient.duplicate();

const correlationIdToResolveMap = new Map<string, (data: EngineResponse.ENGINE_RESPONSE) => void>()

export function sendToEngine(engineRequest: EngineRequest.BACKEND_ENGINE_REQUEST): Promise<EngineResponse.ENGINE_RESPONSE> {

  return new Promise((resolve, reject) => {

    correlationIdToResolveMap.set(engineRequest.correlationId, resolve);

    setTimeout(() => {
      correlationIdToResolveMap.delete(engineRequest.correlationId);
      reject(new Error("Timeout"));
    }, 10000)

    publisher.xAdd(process.env.ENGINE_STREAM!, "*", { data: JSON.stringify(engineRequest) });

  })

}

function handleEngineResponse(rawMessage: unknown) {
  const { success, data } = EngineResponse.ENGINE_RESPONSE_SCHEMA.safeParse(rawMessage);
  if (!success) {
    console.error("Could not parse engine response:", rawMessage);
    return;
  }

  if (data.type === "liquidation") {
    return;
  }

  const resolve = correlationIdToResolveMap.get(data.correlationId);
  if (!resolve) {
    return;
  }
  correlationIdToResolveMap.delete(data.correlationId);
  resolve(data);
}

async function engineToBackendLoop() {
  let lastId = '$'
  while (1) {

    const response = await subscriber.xRead([{
      key: process.env.BACKEND_STREAM!,
      id: lastId
    }], {
      COUNT: 100,
      BLOCK: 0
    }) as RedisStreamResponse;

    if (!response || !Array.isArray(response)) {
      continue;
    }

    for (const stream of response) {
      for (const msg of stream.messages) {
        lastId = msg.id;
        const parsedMessage = JSON.parse(msg.message.data!)
        handleEngineResponse(parsedMessage)
      }
    }
  }
}

export async function initializeRedis() {
  await Promise.all([
    connectRedisClient(subscriber, "Backend-Subscriber"),
    connectRedisClient(publisher, "Backend-Publisher")
  ]);

  // Run the read loop in the background
  engineToBackendLoop().catch((err) => {
    console.error("[Backend] Engine loop error:", err);
    process.exit(1);
  });
}