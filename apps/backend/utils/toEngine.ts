import 'dotenv/config'
import { createClient } from "redis"
import type { EngineRequest } from "shared-types"
import { EngineResponse } from "shared-types"

const publisher = createClient();
const subscriber = createClient()

type RedisStreamResponse = Array<{
  name: string;
  messages: Array<{
    id: string;
    message: Record<string, string>;
  }>;
}> | null;

// Maps correlationId → the resolve() of the promise waiting for that response
const correlationIdToResolveMap = new Map<string, (data: EngineResponse.ENGINE_RESPONSE) => void>()

export function toEngine(engineRequest: EngineRequest.BACKEND_ENGINE_REQUEST): Promise<EngineResponse.ENGINE_RESPONSE> {

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

  // Liquidation is a broadcast event — no one is waiting for it via a promise.
  // DB poller and WS will consume it separately from the to-backend stream.
  if (data.type === "liquidation") {
    return;
  }

  // After the type check above, TypeScript knows data is one of the response
  // variants that all carry a correlationId.
  const resolve = correlationIdToResolveMap.get(data.correlationId);
  if (!resolve) {
    return;
  }
  correlationIdToResolveMap.delete(data.correlationId);
  resolve(data);
}

async function engineToBackend() {
  await subscriber.connect()
  let lastId = '$'
  while (1) {

    const response = await subscriber.xRead([{
      key: "to-backend",
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

engineToBackend()