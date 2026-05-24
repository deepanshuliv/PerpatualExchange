import { createClient } from "redis"
import type { EngineResponse } from "types";

const publisher = createClient();
const subscriber = createClient();


await Promise.all([publisher.connect(), subscriber.connect()]);


function publishToResponseStream(engineRequest: EngineResponse) {
    setInterval(async () => {
        await publisher.xAdd(process.env.RESPONSE_STREAM!, "*", { data: JSON.stringify(engineRequest) })
        console.log("mesage publish to ", process.env.RESPONSE_STREAM!)
    }, 1000)
}


async function subscribeToRequestStream() {
    while (1) {
        const repsonse = await subscriber.xRead({ key: process.env.REQUEST_STREAM!, id: "$" }, { BLOCK: 0, COUNT: 1 });
        const parsedMessage = JSON.parse(repsonse.data)
    }
}

