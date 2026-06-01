import { WebSocketServer } from 'ws';
import { redisClient } from '@repo/redis';

const consumerGroups = redisClient.duplicate();
await consumerGroups.connect();



async function startConsumerGroup() {
    while (1) {
        const response = await consumerGroups.xReadGroup("ws-group", "ws", { key: "to-backend", id: ">" }, { BLOCK: 0, COUNT: 100 });
        if (!response) {
            continue;
        }

        const parsedMessage = JSON.parse(response.toString());
        
    }

}

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', function connection(ws) {
    ws.on('error', console.error);

    ws.on('message', function message(data) {
        console.log('received: %s', data);
    });

    ws.send('something');
});