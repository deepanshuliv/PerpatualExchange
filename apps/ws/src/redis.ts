import { redisClient } from '@repo/redis';
import { WebsocketTypes } from '@repo/shared-types';
import { checkMarketUpdateAndSendToSubsribedUser } from '..';

export async function startConsumerGroup() {
  const consumerGroups = redisClient.duplicate();
  await consumerGroups.connect();

  while (1) {
    const response = await consumerGroups.xReadGroup(
      'ws-group',
      'ws',
      { key: 'to-backend', id: '>' },
      { BLOCK: 0, COUNT: 100 },
    );
    if (!response) continue;

    const {success , data} = WebsocketTypes.WsStreamingResponse.safeParse(response);

    if(!success){
        continue;
    }

    checkMarketUpdateAndSendToSubsribedUser(data);


  }
}
