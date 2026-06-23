import { redisClient } from '@repo/redis';
import { WebsocketTypes } from '@repo/shared-types';
import { checkMarketUpdateAndSendToSubsribedUser } from '..';

export async function startConsumerGroup() {
  const consumerGroups = redisClient.duplicate();
  await consumerGroups.connect();

  while (1) {
    const response = (await consumerGroups.xReadGroup(
      'ws-group',
      'ws',
      { key: 'to-backend', id: '>' },
      { BLOCK: 0, COUNT: 100 },
    )) as unknown as Array<{
      name: string;
      messages: Array<{
        id: string;
        message: {
          [key: string]: string;
        };
      }>;
    }> | null;
    if (!response) continue;
    if (!Array.isArray(response)) continue;

    for (const stream of response) {
      if (!stream) continue;
      for (const message of stream.messages) {
        const data = WebsocketTypes.WsStreamingResponse.parse(
          JSON.parse(message.message.data ?? '{}'),
        );

        checkMarketUpdateAndSendToSubsribedUser(data);

        await consumerGroups.xAck('to-backend', 'ws-group', message.id);
      }
    }
  }
}
