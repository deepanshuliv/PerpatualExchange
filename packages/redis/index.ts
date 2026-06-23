import { createClient, type RedisClientType } from "redis";

const redisClient = createClient({ url: process.env.REDIS_URL! });

redisClient.on("error", (err) => {
    console.log("redis error : ", err);
});

export async function connectRedisClient(client: any, serviceName: string): Promise<any> {
  const handleDisconnect = (err: any) => {
    console.error(`[${serviceName}] Redis connection went down, exiting process:`, err);
    process.exit(1);
  };

  client.on('error', (err: any) => {
    console.error(`[${serviceName}] Redis error:`, err);
    handleDisconnect(err);
  });

  client.on('end', () => {
    handleDisconnect(new Error("Connection ended by Redis server"));
  });

  if (!client.isOpen) {
    await client.connect();
  }

  return client;
}

export { redisClient };
export type { RedisClientType };