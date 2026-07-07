import { prisma } from '@repo/db';
import { BackendRequest, EngineRequest, Shared } from '@repo/shared-types';
import crypto from 'crypto';
import type { Request, Response } from 'express';
import { callEngine } from '../utils/callEngine';
import { sendToEngine } from '../utils/toEngine';

export async function onRamp(req: Request, res: Response){
  const { success, data } = BackendRequest.ADD_BALANCE_SCHEMA.safeParse(req.body);
  if (!success) {
    return res.status(411).json({ msg: 'invalid input fields' });
  }

  return callEngine(
    res,
    {
      correlationId: data.correlationId,
      type: data.type,
      payload: { userId: req.userId!, amount: data.data.amount },
    },
    201,
  );
}

export async function createOrder(req: Request, res: Response) {
  const { success, data } = BackendRequest.CREATE_ORDER_SCHEMA.safeParse(req.body);
  if (!success) {
    return res.status(411).json({ msg: 'invalid input fields' });
  }

  const { qty, price, market, type, kind, margin } = data.data;

  return callEngine(res, {
    correlationId: data.correlationId,
    type: 'create_order',
    payload: {
      userId: req.userId!,
      kind,
      qty: Number(qty),
      price,
      market,
      type,
      margin: Number(margin),
    },
  });
}

export async function cancelOrder(req: Request, res: Response) {
  const { success, data } = BackendRequest.CANCEL_ORDER_SCHEMA.safeParse(req.body);
  if (!success) {
    return res.status(411).json({ msg: 'invalid input fields' });
  }

  return callEngine(res, {
    correlationId: data.correlationId,
    type: 'cancel_order',
    payload: { userId: req.userId!, orderId: data.data.orderId },
  });
}

export async function getAvailableEquity(req: Request, res: Response) {
  return callEngine(res, {
    correlationId: crypto.randomUUID(),
    type: 'get_balance',
    payload: { userId: req.userId! },
  });
}

export async function getOpenPositions(req: Request, res: Response) {
  const marketId = req.params.marketId === 'all' ? undefined : req.params.marketId;
  let market: Shared.MARKET_AVAILABEL | undefined;

  if (marketId !== undefined) {
    const parsed = Shared.MARKET_AVAILABEL_SCHEMA.safeParse(marketId);
    if (!parsed.success) {
      return res.status(400).json({ msg: 'invalid market' });
    }
    market = parsed.data;
  }

  return callEngine(res, {
    correlationId: crypto.randomUUID(),
    type: 'get_position',
    payload: { userId: req.userId!, market },
  });
}

export async function getOpenOrders(req: Request, res: Response) {
  let marketId = req.params.marketId;
  if (Array.isArray(marketId)) {
    marketId = marketId[0];
  }

  let market: Shared.MARKET_AVAILABEL | undefined;
  if (marketId !== undefined && marketId !== 'all') {
    const parsed = Shared.MARKET_AVAILABEL_SCHEMA.safeParse(marketId);
    if (!parsed.success) {
      return res.status(400).json({ msg: 'invalid market' });
    }
    market = parsed.data;
  }

  try {
    const where: any = {
      userId: req.userId!,
      status: { in: ['OPEN', 'PARTIALLY_FILLED'] },
    };
    if (market) {
      where.market = market;
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { transactionTime: 'desc' },
    });

    const openOrders = [];
    for (const order of orders) {
      if (order.filledQty >= order.totalQty) continue;

      openOrders.push({
        orderId: order.id,
        userId: order.userId,
        type: order.type,
        qty: order.totalQty,
        totalQty: order.totalQty,
        filledQty: order.filledQty,
        price: order.price,
        status: order.status,
        margin: order.margin,
        kind: order.kind,
        market: order.market,
        createdAt: order.createdAt,
        transactionTime: order.transactionTime,
      });
    }

    return res.status(200).json({ ok: true, data: openOrders });
  } catch (err) {
    console.log('[orders/open] DB error:', err);
    return res.status(500).json({ msg: 'failed to fetch open orders' });
  }
}

export async function getFills(req: Request, res: Response) {
  return callEngine(res, {
    correlationId: crypto.randomUUID(),
    type: 'get_fills',
    payload: { userId: req.userId! },
  });
}

export async function getDepth(req: Request, res: Response) {
  const parsed = Shared.MARKET_AVAILABEL_SCHEMA.safeParse(req.params.marketId);
  if (!parsed.success) {
    return res.status(400).json({ msg: 'invalid market' });
  }

  try {
    const reply = await sendToEngine({
      correlationId: crypto.randomUUID(),
      type: 'get_depth',
      payload: { market: parsed.data },
    });

    if (!reply) {
      return res.status(503).json({ msg: 'engine unavailable' });
    }

    if (reply.type === 'error') {
      return res.status(400).json({ msg: reply.payload.error });
    }

    return res.status(200).json({ ok: true, data: reply.payload });
  } catch (err: any) {
    if (err?.message?.includes('Timeout')) {
      return res.status(200).json({ ok: true, data: { bids: [], asks: [] } });
    }
    return res.status(503).json({ msg: 'engine unavailable' });
  }
}

export async function getLiquidations(req: Request, res: Response) {
  const parsed = Shared.MARKET_AVAILABEL_SCHEMA.safeParse(req.params.marketId);
  if (!parsed.success) {
    return res.status(400).json({ msg: 'invalid market' });
  }

  try {
    const orders = await prisma.order.findMany({
      where: {
        market: parsed.data as any,
        type: 'MARKET',
        margin: 0,
        status: { in: ['FILLED', 'PARTIALLY_FILLED'] },
      },
      orderBy: { transactionTime: 'desc' },
      take: 100,
      select: {
        userId: true,
        kind: true,
        filledQty: true,
        totalQty: true,
        price: true,
        transactionTime: true,
      },
    });

    const data = [];
    for (const order of orders) {
      data.push({
        userId: order.userId,
        kind: order.kind,
        price: order.price,
        qty: order.filledQty,
        totalQty: order.totalQty,
        time: order.transactionTime.getTime(),
      });
    }

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    console.log('[liquidations] DB error:', error);
    return res.status(200).json({ ok: true, data: [] });
  }
}

export async function getCandles(req: Request, res: Response) {
  const parsedMarket = Shared.MARKET_AVAILABEL_SCHEMA.safeParse(req.params.marketId);
  if (!parsedMarket.success) {
    return res.status(400).json({ msg: 'invalid market' });
  }

  const interval = req.params.interval;
  if (interval !== '1h' && interval !== '1d') {
    return res.status(400).json({ msg: 'invalid interval, use 1h or 1d' });
  }

  let limit = 200;
  if (typeof req.query.limit === 'string') {
    const n = Number(req.query.limit);
    if (n > 0) limit = Math.min(n, 1000);
  }

  const market = parsedMarket.data;

  try {
    let candles;
    if (interval === '1h') {
      candles = await prisma.candle1h.findMany({
        where: { market: market as any },
        orderBy: { openTime: 'desc' },
        take: limit,
      });
    } else {
      candles = await prisma.candle1d.findMany({
        where: { market: market as any },
        orderBy: { openTime: 'desc' },
        take: limit,
      });
    }

    const data = [];
    for (let i = candles.length - 1; i >= 0; i--) {
      const candle = candles[i]!;
      data.push({
        market: candle.market,
        interval,
        openTime: candle.openTime.getTime(),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      });
    }

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    console.log('[candles] DB error:', error);
    return res.status(200).json({ ok: true, data: [] });
  }
}

export async function getTickerPrice(req: Request, res: Response) {
  const parsed = Shared.MARKET_AVAILABEL_SCHEMA.safeParse(req.params.marketId);
  if (!parsed.success) {
    return res.status(400).json({ msg: 'invalid market' });
  }

  try {
    const lastFill = await prisma.fill.findFirst({
      where: { order: { market: parsed.data as any } },
      orderBy: { transactionTime: 'desc' },
      select: { price: true },
    });

    const price = lastFill ? lastFill.price : 0;
    return res.status(200).json({ ok: true, price });
  } catch (error) {
    console.log('[ticker/price] DB error:', error);
    return res.status(200).json({ ok: true, price: 0 });
  }
}
