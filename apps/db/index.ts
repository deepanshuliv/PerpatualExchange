import { prisma } from "@repo/db";
import { redisClient, connectRedisClient } from "@repo/redis";
import { EngineResponse, type RedisStreamResponse } from '@repo/shared-types';
import crypto from "crypto";

const CONSUMER_GROUP = process.env.DB_CONSUMER_GROUP!;
const STREAM_KEY = process.env.BACKEND_STREAM!;

async function startConsumerWorker(consumerName: string) {
  const subscriber = redisClient.duplicate();
  await connectRedisClient(subscriber, `DBConsumer-${consumerName}`);

  // create consumer group if it does not exist yet
  try {
    await subscriber.xGroupCreate(STREAM_KEY, CONSUMER_GROUP, "0", {
      MKSTREAM: true,
    });
  } catch (err: any) {
    if (err.message && err.message.includes("BUSYGROUP")) {
      // group already exists, thats fine
    } else {
      console.error(`[DB Consumer Worker - ${consumerName}] Failed to initialize consumer group:`, err);
      process.exit(1);
    }
  }

  const BATCH_SIZE = 50;

  while (true) {
    try {
      // first try to read pending messages (for crash recovery)
      let response = (await subscriber.xReadGroup(
        CONSUMER_GROUP,
        consumerName,
        [{ key: STREAM_KEY, id: '0' }],
        { COUNT: BATCH_SIZE, BLOCK: 1000 },
      )) as unknown as RedisStreamResponse;

      // if no pending messages, read new ones
      if (!response || response.length === 0 || response[0]!.messages.length === 0) {
        response = (await subscriber.xReadGroup(
          CONSUMER_GROUP,
          consumerName,
          [{ key: STREAM_KEY, id: '>' }],
          { COUNT: BATCH_SIZE, BLOCK: 1000 },
        )) as unknown as RedisStreamResponse;
      }

      if (!response || response.length === 0) {
        continue;
      }

      for (const stream of response) {
        const messages = stream.messages;
        if (messages.length === 0) continue;

        const batchOrderIds: string[] = [];
        const parsedMessages: Array<{ msgId: string; event: any }> = [];

        // step 1: parse messages from redis
        for (const msg of messages) {
          try {
            const parsed = JSON.parse(msg.message.data!);
            const parseResult = EngineResponse.DB_PERSISTENCE_EVENT_SCHEMA.safeParse(parsed);

            if (parseResult.success) {
              const event = parseResult.data;

              if (event.type === "create_order" || event.type === "liquidation" || event.type === "cancel_order") {
                parsedMessages.push({ msgId: msg.id, event });
                batchOrderIds.push(event.payload.orderId);

                // also collect maker order ids from fills
                if (event.type !== "cancel_order") {
                  const fills = event.payload.fills ?? [];
                  for (const fill of fills) {
                    batchOrderIds.push(fill.orderId);
                  }
                }
              } else {
                // we dont care about get_balance etc, just ack them
                await subscriber.xAck(STREAM_KEY, CONSUMER_GROUP, msg.id);
              }
            } else {
              await subscriber.xAck(STREAM_KEY, CONSUMER_GROUP, msg.id);
            }
          } catch (e) {
            await subscriber.xAck(STREAM_KEY, CONSUMER_GROUP, msg.id);
          }
        }

        if (parsedMessages.length === 0) continue;

        // step 2: check which orders already exist in db
        const uniqueBatchOrderIds = [...new Set(batchOrderIds)];
        const existingOrders = await prisma.order.findMany({
          where: { id: { in: uniqueBatchOrderIds } },
        });

        const existingOrdersMap = new Map<string, (typeof existingOrders)[0]>();
        for (const order of existingOrders) {
          existingOrdersMap.set(order.id, order);
        }

        const existingOrderIds = new Set<string>();
        for (const order of existingOrders) {
          existingOrderIds.add(order.id);
        }

        // stuff we will write to db in one transaction
        const usersMap = new Map<string, { id: string; username: string; password: string }>();
        const ordersToCreate = new Map<string, any>();
        const ordersToUpdate = new Map<string, { filledQty: number; status: string }>();
        const cancelUpserts = new Map<string, any>();
        const makerFillAcc = new Map<string, number>(); // how much qty got filled for maker orders
        const fillsToCreate: any[] = [];
        const processedMessageIds: string[] = [];

        // step 3: go through each event and figure out what to insert/update
        for (const { msgId, event } of parsedMessages) {
          if (event.type === "create_order") {
            const {
              orderId,
              userId,
              kind,
              market,
              price,
              type,
              margin,
              status,
              fills,
              totalQty,
              filledQty,
              transactionTime,
            } = event.payload;

            // create user if needed
            usersMap.set(userId, { id: userId, username: `user_${userId}`, password: "" });

            // insert new order or update if it already exists (retry case)
            if (!existingOrderIds.has(orderId)) {
              ordersToCreate.set(orderId, {
                id: orderId,
                userId,
                kind: kind as any,
                market: market as any,
                price,
                type: type as any,
                margin,
                status: status as any,
                totalQty,
                filledQty,
                transactionTime: new Date(transactionTime),
              });
            } else {
              ordersToUpdate.set(orderId, {
                filledQty,
                status: status as string,
              });
            }

            // process fills from this order
            const fillList = fills ?? [];
            for (const fill of fillList) {
              usersMap.set(fill.buyerId, { id: fill.buyerId, username: `user_${fill.buyerId}`, password: "" });
              usersMap.set(fill.sellerId, { id: fill.sellerId, username: `user_${fill.sellerId}`, password: "" });

              // track maker order fill qty (skip taker's own orderId)
              if (fill.orderId !== orderId) {
                const oldQty = makerFillAcc.get(fill.orderId) ?? 0;
                makerFillAcc.set(fill.orderId, oldQty + fill.qty);
              }

              // if maker order not in db yet, create a placeholder order
              const alreadyInCreateMap = ordersToCreate.get(fill.orderId);
              const isSkeleton = alreadyInCreateMap && alreadyInCreateMap.isSkeleton;
              if (!alreadyInCreateMap || isSkeleton) {
                if (!existingOrderIds.has(fill.orderId)) {
                  let skeletonFilledQty = 0;
                  if (fill.status === "FILLED") {
                    skeletonFilledQty = fill.qty;
                  }

                  ordersToCreate.set(fill.orderId, {
                    id: fill.orderId,
                    userId: fill.kind === "LONG" ? fill.buyerId : fill.sellerId,
                    type: fill.type as any,
                    totalQty: fill.qty,
                    filledQty: skeletonFilledQty,
                    price: fill.price,
                    status: fill.status as any,
                    margin: 0,
                    kind: fill.kind as any,
                    market: market as any,
                    isSkeleton: true,
                    transactionTime: new Date(fill.transactionTime || transactionTime),
                  });
                }
              }

              fillsToCreate.push({
                orderId: fill.orderId,
                buyerId: fill.buyerId,
                sellerId: fill.sellerId,
                price: fill.price,
                qty: fill.qty,
                type: fill.type as any,
                kind: fill.kind as any,
                status: fill.status as any,
                createdAt: new Date(fill.createdAt),
                transactionTime: new Date(fill.transactionTime || transactionTime),
              });
            }

            processedMessageIds.push(msgId);
          } else if (event.type === "cancel_order") {
            const { orderId, userId, price, totalQty, filledQty, margin, kind, market, transactionTime } = event.payload;

            usersMap.set(userId, { id: userId, username: `user_${userId}`, password: "" });

            cancelUpserts.set(orderId, {
              id: orderId,
              userId,
              type: "LIMIT",
              totalQty,
              filledQty,
              price,
              status: "CANCELLED",
              margin,
              kind: kind as any,
              market: market as any,
              transactionTime: new Date(transactionTime),
            });

            processedMessageIds.push(msgId);
          } else if (event.type === "liquidation") {
            const { orderId, userId, kind, market, filledQty, totalQty, totalSpent, fills, transactionTime } = event.payload;

            let avgPrice = 0;
            if (totalQty > 0) {
              avgPrice = totalSpent / totalQty;
            }

            let status = "PARTIALLY_FILLED";
            if (filledQty === totalQty) {
              status = "FILLED";
            }

            usersMap.set(userId, { id: userId, username: `user_${userId}`, password: "" });

            if (!existingOrderIds.has(orderId)) {
              ordersToCreate.set(orderId, {
                id: orderId,
                userId,
                kind: kind as any,
                market: market as any,
                price: avgPrice,
                type: "MARKET",
                margin: 0,
                status: status as any,
                totalQty,
                filledQty,
                transactionTime: new Date(transactionTime),
              });
            } else {
              ordersToUpdate.set(orderId, { filledQty, status });
            }

            // process fills (same as create_order)
            const fillList = fills ?? [];
            for (const fill of fillList) {
              usersMap.set(fill.buyerId, { id: fill.buyerId, username: `user_${fill.buyerId}`, password: "" });
              usersMap.set(fill.sellerId, { id: fill.sellerId, username: `user_${fill.sellerId}`, password: "" });

              if (fill.orderId !== orderId) {
                const oldQty = makerFillAcc.get(fill.orderId) ?? 0;
                makerFillAcc.set(fill.orderId, oldQty + fill.qty);
              }

              const alreadyInCreateMap = ordersToCreate.get(fill.orderId);
              const isSkeleton = alreadyInCreateMap && alreadyInCreateMap.isSkeleton;
              if (!alreadyInCreateMap || isSkeleton) {
                if (!existingOrderIds.has(fill.orderId)) {
                  let skeletonFilledQty = 0;
                  if (fill.status === "FILLED") {
                    skeletonFilledQty = fill.qty;
                  }

                  ordersToCreate.set(fill.orderId, {
                    id: fill.orderId,
                    userId: fill.kind === "LONG" ? fill.buyerId : fill.sellerId,
                    type: fill.type as any,
                    totalQty: fill.qty,
                    filledQty: skeletonFilledQty,
                    price: fill.price,
                    status: fill.status as any,
                    margin: 0,
                    kind: fill.kind as any,
                    market: market as any,
                    isSkeleton: true,
                    transactionTime: new Date(fill.transactionTime || transactionTime),
                  });
                }
              }

              fillsToCreate.push({
                orderId: fill.orderId,
                buyerId: fill.buyerId,
                sellerId: fill.sellerId,
                price: fill.price,
                qty: fill.qty,
                type: fill.type as any,
                kind: fill.kind as any,
                status: fill.status as any,
                createdAt: new Date(fill.createdAt),
                transactionTime: new Date(fill.transactionTime || transactionTime),
              });
            }

            processedMessageIds.push(msgId);
          }
        }

        // step 4: apply maker fill updates so resting orders get correct status in db
        for (const [makerOrderId, fillQty] of makerFillAcc) {
          // dont update if order was cancelled
          if (cancelUpserts.has(makerOrderId)) {
            continue;
          }

          const existing = existingOrdersMap.get(makerOrderId);
          if (existing) {
            const newFilledQty = existing.filledQty + fillQty;

            let newStatus = "OPEN";
            if (newFilledQty >= existing.totalQty) {
              newStatus = "FILLED";
            } else if (newFilledQty > 0) {
              newStatus = "PARTIALLY_FILLED";
            }

            ordersToUpdate.set(makerOrderId, {
              filledQty: newFilledQty,
              status: newStatus,
            });
            continue;
          }

          // order might be getting created in same batch
          const pending = ordersToCreate.get(makerOrderId);
          if (pending) {
            const newFilledQty = pending.filledQty + fillQty;

            let newStatus = "OPEN";
            if (newFilledQty >= pending.totalQty) {
              newStatus = "FILLED";
            } else if (newFilledQty > 0) {
              newStatus = "PARTIALLY_FILLED";
            }

            pending.filledQty = newFilledQty;
            pending.status = newStatus;
          }
        }

        // step 5: write everything to db in one transaction
        try {
          await prisma.$transaction(async (tx) => {
            // insert users
            if (usersMap.size > 0) {
              const usersList = [];
              for (const user of usersMap.values()) {
                usersList.push(user);
              }
              await tx.user.createMany({
                data: usersList,
                skipDuplicates: true,
              });
            }

            // insert new orders
            if (ordersToCreate.size > 0) {
              const ordersList = [];
              for (const order of ordersToCreate.values()) {
                // remove isSkeleton before inserting, its just for our internal use
                const { isSkeleton, ...orderData } = order;
                ordersList.push(orderData);
              }
              await tx.order.createMany({
                data: ordersList as any,
                skipDuplicates: true,
              });
            }

            // update orders that changed status (taker retry or maker got filled)
            for (const [orderId, update] of ordersToUpdate) {
              await tx.order.update({
                where: { id: orderId },
                data: {
                  filledQty: update.filledQty,
                  status: update.status as any,
                },
              });
            }

            // handle cancelled orders
            for (const cancelData of cancelUpserts.values()) {
              await tx.order.upsert({
                where: { id: cancelData.id },
                update: {
                  status: "CANCELLED",
                  filledQty: cancelData.filledQty,
                },
                create: cancelData as any,
              });
            }

            // insert fills
            if (fillsToCreate.length > 0) {
              await tx.fill.createMany({
                data: fillsToCreate,
              });
            }
          });

          // ack messages only after db write succeeded
          if (processedMessageIds.length > 0) {
            await subscriber.xAck(STREAM_KEY, CONSUMER_GROUP, processedMessageIds);
          }
        } catch (txError) {
          console.error(`[DB Consumer Worker - ${consumerName}] Transaction failed for batch. Retrying whole batch. Error:`, txError);
          // dont ack, so redis will retry
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    } catch (loopError) {
      console.error(`[DB Consumer Worker - ${consumerName}] Error in consumer loop:`, loopError);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

async function startMultiConsumer() {
  const CONCURRENCY = parseInt(process.env.CONCURRENCY || "3");
  const instanceId = crypto.randomBytes(3).toString("hex");

  const workers = [];
  for (let i = 1; i <= CONCURRENCY; i++) {
    const workerName = `db-worker-${instanceId}-${i}`;
    workers.push(startConsumerWorker(workerName));
  }

  await Promise.all(workers);
}

startMultiConsumer().catch((err) => {
  console.error("[DB Consumer] Unhandled consumer startup error:", err);
  process.exit(1);
});
