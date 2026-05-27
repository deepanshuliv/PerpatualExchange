import { parse } from 'dotenv';
import 'dotenv/config'
import { createClient } from "redis"
import type { BackendRequest, EngineRequest } from "shared-types"

const publisher = createClient();
const subscriber = createClient()

type RedisStreamResponse = Array<{
  name: string;
  messages: Array<{
    id: string;
    message: Record<string, string>;
  }>;
}> | null;

const correlationIdToResolveMap = new Map<string, (data: any) => void>()

export function toEngine(engineRequest: EngineRequest.ENGINE_REQUEST): Promise<BackendRequest.BACKEND_REQUEST> {

  return new Promise((resolve, reject) => {

    correlationIdToResolveMap.set(engineRequest.correlationId, resolve);

    setTimeout(() => {
      correlationIdToResolveMap.delete(engineRequest.correlationId);
      reject(new Error("Timeout"));
    }, 10000)

    publisher.xAdd(process.env.RESPONSE_STREAM!, "*", { data: JSON.stringify(engineRequest) });

  })

}

function handleEngineResponse(parsedMessage: unknown) {
  const response = correlationIdToResolveMap.get(parsedMessage.correlationId);
  if (!response) {
    return
  }
  response(parsedMessage.payload)
}

async function engineTOBackend() {
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
        const parsedMessage = JSON.parse(msg.message.data!)
        handleEngineResponse(parsedMessage)
      }
    }
  }
}
// toEngine("121212" , )
engineTOBackend()