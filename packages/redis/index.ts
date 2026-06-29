import { createClient } from "redis";

// read redis url from environment variable
const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is missing in environment variables");
}

// main redis client used across the app
const redisClient = createClient({
  url: redisUrl,
});

type RedisClientType = typeof redisClient;

// log errors from the default client
redisClient.on("error", (err) => {
  console.log("redis error : ", err);
});

// we only want to attach listeners one time per client
const setupClients = new Set<RedisClientType>();

export async function connectRedisClient(
  client: RedisClientType,
  serviceName: string,
): Promise<RedisClientType> {
  // attach error handlers the first time we see this client
  if (!setupClients.has(client)) {
    setupClients.add(client);

    client.on("error", (err) => {
      console.error(`[${serviceName}] Redis error:`, err);
      console.error(`[${serviceName}] shutting down because redis failed`);
      process.exit(1);
    });

    client.on("end", () => {
      console.error(`[${serviceName}] Redis connection ended`);
      process.exit(1);
    });
  }

  // connect only if not connected yet
  if (client.isOpen === false) {
    await client.connect();
    console.log(`[${serviceName}] connected to redis`);
  }

  return client;
}

export { redisClient };
export type { RedisClientType };
