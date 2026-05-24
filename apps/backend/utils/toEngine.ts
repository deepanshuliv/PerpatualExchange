import 'dotenv/config'
import { createClient } from "redis"
import type { EngineRequest, EngineResponse } from "types"
import { response } from "express";

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

export function toEngine( engineRequest: EngineRequest ) :Promise<EngineRequest>{

  return new Promise((resolve, reject) => {
    correlationIdToResolveMap.set(engineRequest.correlationId, resolve);
    setTimeout(() => {
      correlationIdToResolveMap.delete(engineRequest.correlationId);
      reject(new Error("Timeout"));
    }, 10000)

    publisher.xAdd(process.env.RESPONSE_STREAM!, "*", { data: JSON.stringify(engineRequest) });
  })

}


async function engineTOBackend() {
  await subscriber.connect()
  let lastId = '$' 
  

  while (1) {

    const response = await subscriber.xRead([{
      key: "to-backend",
      id: lastId
    }], {
      COUNT: 10,
      BLOCK: 0
    }) as RedisStreamResponse;

    console.log(response);

    if (!response) {
      continue;
    }

    if (response && response.length > 0) {
      const messages = response[0].messages;
      lastId = messages[messages.length - 1].id; 
      
      console.log("Response strem  resopnse", messages);

    }
  }
}
// toEngine("121212" , )
engineTOBackend()