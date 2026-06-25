import "dotenv/config";
import { prisma } from "@repo/db";
import { redisClient, connectRedisClient } from "@repo/redis";
import { EngineResponse, type RedisStreamResponse } from '@repo/shared-types';
import crypto from "crypto";

const CONSUMER_GROUP = "db-consumer-group";
const STREAM_KEY = "to-backend";

async function startConsumerWorker(consumerName: string) {
  const subscriber = redisClient.duplicate();
  await connectRedisClient(subscriber, `DBConsumer-${consumerName}`);

  try {
    await subscriber.xGroupCreate(STREAM_KEY, CONSUMER_GROUP, "0", {
      MKSTREAM: true,
    });
  } catch (err: any) {
    if (err.message && err.message.includes("BUSYGROUP")) {
    } else {
      console.error(`[DB Consumer Worker - ${consumerName}] Failed to initialize consumer group:`, err);
      process.exit(1);
    }
  }


  const BATCH_SIZE = 50;

  while (true) {
    try {
      // 1. Process pending messages (id = '0') first to handle crash recoveries
      let response = (await subscriber.xReadGroup(
        CONSUMER_GROUP,
        consumerName,
        [{ key: STREAM_KEY, id: '0' }],
        { COUNT: BATCH_SIZE, BLOCK: 1000 },
      )) as unknown as RedisStreamResponse;

      // 2. If no pending messages, read new messages (id = '>')
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

        // Parse and filter down the valid messages to work with
        const batchOrderIds: string[] = [];
        const parsedMessages: Array<{ msgId: string; event: any }> = [];

        for (const msg of messages) {
          try {
            const parsed = JSON.parse(msg.message.data!);
            const parseResult = EngineResponse.ENGINE_RESPONSE_SCHEMA.safeParse(parsed);
            if (parseResult.success) {
              const event = parseResult.data;

              if (event.type === "create_order" || event.type === "liquidation" || event.type === "cancel_order") {
                parsedMessages.push({ msgId: msg.id, event });
                batchOrderIds.push(event.payload.orderId);
              } else {
                // Acknowledge other messages immediately (like add_balance, get_balance)
                await subscriber.xAck(STREAM_KEY, CONSUMER_GROUP, msg.id);
              }
            } else {
              // Invalid schema - acknowledge to remove from stream
              await subscriber.xAck(STREAM_KEY, CONSUMER_GROUP, msg.id);
            }
          } catch (e) {
            // Malformed JSON - acknowledge to remove from stream
            await subscriber.xAck(STREAM_KEY, CONSUMER_GROUP, msg.id);
          }
        }

        if (parsedMessages.length === 0) continue;

        // DB level optimization: Fetch all existing order IDs in the current batch in a single query
        const existingOrderIds = new Set(
          (
            await prisma.order.findMany({
              where: { id: { in: batchOrderIds } },
              select: { id: true },
            })
          ).map((o) => o.id)
        );

        // Accumulators for bulk insertion
        const usersMap = new Map<string, { id: string; username: string; password: string }>();
        const ordersToCreate = new Map<string, any>();
        const ordersToUpdate = new Map<string, any>();
        const fillsToCreate: any[] = [];
        const processedMessageIds: string[] = [];

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

            if (existingOrderIds.has(orderId)) {
              processedMessageIds.push(msgId);
              continue;
            }

            // Queue user creation
            usersMap.set(userId, { id: userId, username: `user_${userId}`, password: "" });

            // Queue order creation
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
              isSkeleton: false,
              transactionTime: new Date(transactionTime),
            });

            // Queue fills and their required users / skeleton orders
            for (const fill of fills) {
              usersMap.set(fill.buyerId, { id: fill.buyerId, username: `user_${fill.buyerId}`, password: "" });
              usersMap.set(fill.sellerId, { id: fill.sellerId, username: `user_${fill.sellerId}`, password: "" });

              // If the maker order does not exist in our create list yet, insert a skeleton order
              const existingInMap = ordersToCreate.get(fill.orderId);
              if (!existingInMap || existingInMap.isSkeleton) {
                ordersToCreate.set(fill.orderId, {
                  id: fill.orderId,
                  userId: fill.kind === "LONG" ? fill.buyerId : fill.sellerId,
                  type: fill.type as any,
                  totalQty: fill.qty,
                  filledQty: fill.status === "FILLED" ? fill.qty : 0,
                  price: fill.price,
                  status: fill.status as any,
                  margin: 0,
                  kind: fill.kind as any,
                  market: market as any,
                  isSkeleton: true,
                  transactionTime: new Date(fill.transactionTime || transactionTime),
                });
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

            // Queue cancel updates
            ordersToUpdate.set(orderId, {
              id: orderId,
              userId,
              type: "LIMIT",
              totalQty: totalQty,
              filledQty: filledQty,
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

            if (existingOrderIds.has(orderId)) {
              processedMessageIds.push(msgId);
              continue;
            }

            const avgPrice = totalQty > 0 ? totalSpent / totalQty : 0;
            const status = filledQty === totalQty ? "FILLED" : "PARTIALLY_FILLED";

            usersMap.set(userId, { id: userId, username: `user_${userId}`, password: "" });

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
              isSkeleton: false,
              transactionTime: new Date(transactionTime),
            });

            for (const fill of fills) {
              usersMap.set(fill.buyerId, { id: fill.buyerId, username: `user_${fill.buyerId}`, password: "" });
              usersMap.set(fill.sellerId, { id: fill.sellerId, username: `user_${fill.sellerId}`, password: "" });

              const existingInMap = ordersToCreate.get(fill.orderId);
              if (!existingInMap || existingInMap.isSkeleton) {
                ordersToCreate.set(fill.orderId, {
                  id: fill.orderId,
                  userId: fill.kind === "LONG" ? fill.buyerId : fill.sellerId,
                  type: fill.type as any,
                  totalQty: fill.qty,
                  filledQty: fill.status === "FILLED" ? fill.qty : 0,
                  price: fill.price,
                  status: fill.status as any,
                  margin: 0,
                  kind: fill.kind as any,
                  market: market as any,
                  isSkeleton: true,
                  transactionTime: new Date(fill.transactionTime || transactionTime),
                });
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

        try {
          // Open a single transaction for the entire batch of messages (Option B)
          await prisma.$transaction(async (tx) => {
            // Step 1: Bulk insert users
            if (usersMap.size > 0) {
              await tx.user.createMany({
                data: Array.from(usersMap.values()),
                skipDuplicates: true,
              });
            }

            // Step 2: Bulk insert orders (stripping temporary isSkeleton field)
            if (ordersToCreate.size > 0) {
              const ordersData = Array.from(ordersToCreate.values()).map(
                ({ isSkeleton, ...rest }) => rest
              );
              await tx.order.createMany({
                data: ordersData,
                skipDuplicates: true,
              });
            }

            // Step 3: Run updates for cancelled orders
            for (const [orderId, cancelData] of ordersToUpdate) {
              await tx.order.upsert({
                where: { id: orderId },
                update: {
                  status: "CANCELLED",
                  filledQty: cancelData.filledQty,
                },
                create: cancelData,
              });
            }

            // Step 4: Bulk insert fills
            if (fillsToCreate.length > 0) {
              await tx.fill.createMany({
                data: fillsToCreate,
              });
            }
          });

          // Acknowledge all successfully processed/skipped messages in the batch together
          if (processedMessageIds.length > 0) {
            await subscriber.xAck(STREAM_KEY, CONSUMER_GROUP, processedMessageIds);
          }
        } catch (txError) {
          console.error(`[DB Consumer Worker - ${consumerName}] Transaction failed for batch. Retrying whole batch. Error:`, txError);
          // Do NOT acknowledge any messages, they remain in the pending list to be retried
          // Sleep to prevent hot looping in case of database issues
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