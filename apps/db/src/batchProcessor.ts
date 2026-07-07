import { prisma } from '@repo/db';
import { EngineResponse } from '@repo/shared-types';
import crypto from 'crypto';
import { persistTicksAndCandles, type TradeTickInput } from './marketData';

const DB_PERSISTENCE_EVENT_SCHEMA = EngineResponse.DB_PERSISTENCE_EVENT_SCHEMA;

type DbEvent = NonNullable<ReturnType<typeof DB_PERSISTENCE_EVENT_SCHEMA.safeParse>['data']>;
type CreateOrderEvent = Extract<DbEvent, { type: 'create_order' }>;
type CancelOrderEvent = Extract<DbEvent, { type: 'cancel_order' }>;
type LiquidationEvent = Extract<DbEvent, { type: 'liquidation' }>;

type Market = 'BTCUSD' | 'ETHUSD' | 'SOLUSD' | 'USD';

interface StreamMessage {
  id: string;
  message: Record<string, string>;
}

interface MessageBuckets {
  createOrders: Array<{ msgId: string; event: CreateOrderEvent }>;
  liquidations: Array<{ msgId: string; event: LiquidationEvent }>;
  cancelOrders: Array<{ msgId: string; event: CancelOrderEvent }>;
  invalidMsgIds: string[];
}

interface UserRecord {
  id: string;
  username: string;
  password: string;
}

interface OrderCreateRecord {
  id: string;
  userId: string;
  type: string;
  totalQty: number;
  filledQty: number;
  price: number;
  status: string;
  margin: number;
  kind: string;
  market: string;
  transactionTime: Date;
  isSkeleton?: boolean;
}

interface OrderUpdateRecord {
  filledQty: number;
  status: string;
}

interface FillRecord {
  id: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  price: number;
  qty: number;
  type: string;
  kind: string;
  status: string;
  createdAt: Date;
  transactionTime: Date;
}

interface BatchWriteState {
  users: Map<string, UserRecord>;
  ordersToCreate: Map<string, OrderCreateRecord>;
  ordersToUpdate: Map<string, OrderUpdateRecord>;
  cancelUpserts: Map<string, OrderCreateRecord>;
  makerFillAcc: Map<string, number>;
  fills: FillRecord[];
  ticks: TradeTickInput[];
}

function ensureUser(users: Map<string, UserRecord>, userId: string) {
  users.set(userId, { id: userId, username: `user_${userId}`, password: '' });
}

function parseStreamMessages(messages: StreamMessage[]): MessageBuckets {
  const buckets: MessageBuckets = {
    createOrders: [],
    liquidations: [],
    cancelOrders: [],
    invalidMsgIds: [],
  };

  for (const msg of messages) {
    try {
      const parsed = JSON.parse(msg.message.data!);
      const result = DB_PERSISTENCE_EVENT_SCHEMA.safeParse(parsed);

      if (!result.success) {
        buckets.invalidMsgIds.push(msg.id);
        continue;
      }

      switch (result.data.type) {
        case 'create_order':
          buckets.createOrders.push({ msgId: msg.id, event: result.data });
          break;
        case 'liquidation':
          buckets.liquidations.push({ msgId: msg.id, event: result.data });
          break;
        case 'cancel_order':
          buckets.cancelOrders.push({ msgId: msg.id, event: result.data });
          break;
      }
    } catch {
      buckets.invalidMsgIds.push(msg.id);
    }
  }

  return buckets;
}

function collectOrderIds(buckets: MessageBuckets): string[] {
  const orderIds = new Set<string>();

  const addFillOrderIds = (fills: CreateOrderEvent['payload']['fills'] | undefined) => {
    for (const fill of fills ?? []) {
      orderIds.add(fill.orderId);
    }
  };

  for (const { event } of buckets.createOrders) {
    orderIds.add(event.payload.orderId);
    addFillOrderIds(event.payload.fills);
  }

  for (const { event } of buckets.liquidations) {
    orderIds.add(event.payload.orderId);
    addFillOrderIds(event.payload.fills);
  }

  for (const { event } of buckets.cancelOrders) {
    orderIds.add(event.payload.orderId);
  }

  return [...orderIds];
}

function processFillEvent(
  state: BatchWriteState,
  existingOrderIds: Set<string>,
  market: Market,
  primaryOrderId: string,
  fallbackTransactionTime: number,
  fills: CreateOrderEvent['payload']['fills'] | undefined,
) {
  for (const fill of fills ?? []) {
    ensureUser(state.users, fill.buyerId);
    ensureUser(state.users, fill.sellerId);

    if (fill.orderId !== primaryOrderId) {
      state.makerFillAcc.set(fill.orderId, (state.makerFillAcc.get(fill.orderId) ?? 0) + fill.qty);
    }

    const pending = state.ordersToCreate.get(fill.orderId);
    const isSkeleton = pending?.isSkeleton === true;

    if ((!pending || isSkeleton) && !existingOrderIds.has(fill.orderId)) {
      const skeletonFilledQty = fill.status === 'FILLED' ? fill.qty : 0;

      state.ordersToCreate.set(fill.orderId, {
        id: fill.orderId,
        userId: fill.kind === 'LONG' ? fill.buyerId : fill.sellerId,
        type: fill.type,
        totalQty: fill.qty,
        filledQty: skeletonFilledQty,
        price: fill.price,
        status: fill.status,
        margin: 0,
        kind: fill.kind,
        market,
        isSkeleton: true,
        transactionTime: new Date(fill.transactionTime || fallbackTransactionTime),
      });
    }

    state.fills.push({
      id: crypto.randomUUID(),
      orderId: fill.orderId,
      buyerId: fill.buyerId,
      sellerId: fill.sellerId,
      price: fill.price,
      qty: fill.qty,
      type: fill.type,
      kind: fill.kind,
      status: fill.status,
      createdAt: new Date(fill.createdAt),
      transactionTime: new Date(fill.transactionTime || fallbackTransactionTime),
    });

    state.ticks.push({
      market,
      price: fill.price,
      volume: fill.qty,
      time: new Date(fill.transactionTime || fallbackTransactionTime),
    });
  }
}

function processCreateOrder(
  state: BatchWriteState,
  existingOrderIds: Set<string>,
  event: CreateOrderEvent,
) {
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

  ensureUser(state.users, userId);

  if (!existingOrderIds.has(orderId)) {
    state.ordersToCreate.set(orderId, {
      id: orderId,
      userId,
      kind,
      market,
      price,
      type,
      margin,
      status,
      totalQty,
      filledQty,
      transactionTime: new Date(transactionTime),
    });
  } else {
    state.ordersToUpdate.set(orderId, { filledQty, status });
  }

  processFillEvent(state, existingOrderIds, market, orderId, transactionTime, fills);
}

function processLiquidation(
  state: BatchWriteState,
  existingOrderIds: Set<string>,
  event: LiquidationEvent,
) {
  const {
    orderId,
    userId,
    kind,
    market,
    filledQty,
    totalQty,
    totalSpent,
    fills,
    transactionTime,
  } = event.payload;

  const avgPrice = totalQty > 0 ? totalSpent / totalQty : 0;
  const status = filledQty === totalQty ? 'FILLED' : 'PARTIALLY_FILLED';

  ensureUser(state.users, userId);

  if (!existingOrderIds.has(orderId)) {
    state.ordersToCreate.set(orderId, {
      id: orderId,
      userId,
      kind,
      market,
      price: avgPrice,
      type: 'MARKET',
      margin: 0,
      status,
      totalQty,
      filledQty,
      transactionTime: new Date(transactionTime),
    });
  } else {
    state.ordersToUpdate.set(orderId, { filledQty, status });
  }

  processFillEvent(state, existingOrderIds, market, orderId, transactionTime, fills);
}

function processCancelOrder(state: BatchWriteState, event: CancelOrderEvent) {
  const {
    orderId,
    userId,
    price,
    totalQty,
    filledQty,
    margin,
    kind,
    market,
    transactionTime,
  } = event.payload;

  ensureUser(state.users, userId);

  state.cancelUpserts.set(orderId, {
    id: orderId,
    userId,
    type: 'LIMIT',
    totalQty,
    filledQty,
    price,
    status: 'CANCELLED',
    margin,
    kind,
    market,
    transactionTime: new Date(transactionTime),
  });
}

function applyMakerFillUpdates(
  state: BatchWriteState,
  existingOrdersMap: Map<string, { filledQty: number; totalQty: number }>,
) {
  for (const [makerOrderId, fillQty] of state.makerFillAcc) {
    if (state.cancelUpserts.has(makerOrderId)) continue;

    const existing = existingOrdersMap.get(makerOrderId);
    if (existing) {
      const newFilledQty = existing.filledQty + fillQty;
      state.ordersToUpdate.set(makerOrderId, {
        filledQty: newFilledQty,
        status: deriveStatus(newFilledQty, existing.totalQty),
      });
      continue;
    }

    const pending = state.ordersToCreate.get(makerOrderId);
    if (pending) {
      const newFilledQty = pending.filledQty + fillQty;
      pending.filledQty = newFilledQty;
      pending.status = deriveStatus(newFilledQty, pending.totalQty);
    }
  }
}

function deriveStatus(filledQty: number, totalQty: number): string {
  if (filledQty >= totalQty) return 'FILLED';
  if (filledQty > 0) return 'PARTIALLY_FILLED';
  return 'OPEN';
}

function orderedProcessingQueue(
  buckets: MessageBuckets,
): Array<{ msgId: string; event: DbEvent }> {
  return [...buckets.createOrders, ...buckets.liquidations, ...buckets.cancelOrders];
}

function createEmptyState(): BatchWriteState {
  return {
    users: new Map(),
    ordersToCreate: new Map(),
    ordersToUpdate: new Map(),
    cancelUpserts: new Map(),
    makerFillAcc: new Map(),
    fills: [],
    ticks: [],
  };
}

function sortTicksByTime(ticks: TradeTickInput[]): TradeTickInput[] {
  return [...ticks].sort((a, b) => a.time.getTime() - b.time.getTime());
}

async function persistBatch(state: BatchWriteState) {
  const sortedTicks = sortTicksByTime(state.ticks);

  await prisma.$transaction(async (tx) => {
    if (state.users.size > 0) {
      await tx.user.createMany({
        data: [...state.users.values()],
        skipDuplicates: true,
      });
    }

    if (state.ordersToCreate.size > 0) {
      const ordersList = [...state.ordersToCreate.values()].map(({ isSkeleton: _, ...order }) => order);
      await tx.order.createMany({
        data: ordersList as any,
        skipDuplicates: true,
      });
    }

    for (const [orderId, update] of state.ordersToUpdate) {
      await tx.order.update({
        where: { id: orderId },
        data: {
          filledQty: update.filledQty,
          status: update.status as any,
        },
      });
    }

    for (const cancelData of state.cancelUpserts.values()) {
      await tx.order.upsert({
        where: { id: cancelData.id },
        update: {
          status: 'CANCELLED',
          filledQty: cancelData.filledQty,
        },
        create: cancelData as any,
      });
    }

    if (state.fills.length > 0) {
      await tx.fill.createMany({ data: state.fills as any });
    }

    if (sortedTicks.length > 0) {
      await persistTicksAndCandles(tx as Parameters<typeof persistTicksAndCandles>[0], sortedTicks);
    }
  });
}

export async function processMessageBatch(messages: StreamMessage[]): Promise<{
  ackIds: string[];
  invalidIds: string[];
}> {
  if (messages.length === 0) {
    return { ackIds: [], invalidIds: [] };
  }

  const buckets = parseStreamMessages(messages);
  const queue = orderedProcessingQueue(buckets);

  if (queue.length === 0) {
    return { ackIds: [], invalidIds: buckets.invalidMsgIds };
  }

  const orderIds = collectOrderIds(buckets);
  const existingOrders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, filledQty: true, totalQty: true },
  });

  const existingOrderIds = new Set(existingOrders.map((o) => o.id));
  const existingOrdersMap = new Map(existingOrders.map((o) => [o.id, o]));

  const state = createEmptyState();

  for (const { event } of queue) {
    switch (event.type) {
      case 'create_order':
        processCreateOrder(state, existingOrderIds, event);
        break;
      case 'liquidation':
        processLiquidation(state, existingOrderIds, event);
        break;
      case 'cancel_order':
        processCancelOrder(state, event);
        break;
    }
  }

  applyMakerFillUpdates(state, existingOrdersMap);
  await persistBatch(state);

  return {
    ackIds: queue.map((m) => m.msgId),
    invalidIds: buckets.invalidMsgIds,
  };
}
