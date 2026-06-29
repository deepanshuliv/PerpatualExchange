import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error('REDIS_URL is missing in environment variables');
}

const redisClient = createClient({
  url: redisUrl,
});

type RedisClientType = typeof redisClient;

redisClient.on('error', (err) => {
  console.log('redis error : ', err);
});

const setupClients = new Set<RedisClientType>();

export async function connectRedisClient(
  client: RedisClientType,
  serviceName: string,
): Promise<RedisClientType> {
  if (!setupClients.has(client)) {
    setupClients.add(client);

    client.on('error', (err) => {
      console.log(`[${serviceName}] Redis error:`, err);
      console.log(`[${serviceName}] shutting down because redis failed`);
      process.exit(1);
    });

    client.on('end', () => {
      console.log(`[${serviceName}] Redis connection ended`);
      process.exit(1);
    });
  }

  if (client.isOpen === false) {
    await client.connect();
    console.log(`[${serviceName}] connected to redis`);
  }

  return client;
}

export { redisClient };
export type { RedisClientType };
