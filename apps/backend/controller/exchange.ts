import { prisma } from '@repo/db';
import { BackendRequest, EngineRequest, Shared } from '@repo/shared-types';
import crypto from 'crypto';
import type { Request, Response } from 'express';
import { callEngine } from '../utils/callEngine';
import { getCachedDepth, getCachedMarkPrice, sendToEngine } from '../utils/toEngine';

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
      qty,
      price,
      market,
      type,
      margin,
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
    type: 'get_open_orders',
    payload: { userId: req.userId!, market },
  });
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
    const cached = getCachedDepth(parsed.data);
    if (cached) {
      return res.status(200).json({ ok: true, data: cached });
    }

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
    console.log('[getDepth] error', err);
    if (err?.message?.includes('Timeout')) {
      return res.status(200).json({ ok: true, data: { bids: [], asks: [] } });
    }
    return res.status(503).json({ msg: 'engine unavailable' });
  }
}

export async function getTrades(req: Request, res: Response) {
  const parsed = Shared.MARKET_AVAILABEL_SCHEMA.safeParse(req.params.marketId);
  if (!parsed.success) {
    return res.status(400).json({ msg: 'invalid market' });
  }

  try {
    const fills = await prisma.fill.findMany({
      where: {
        order: { market: parsed.data as any },
      },
      orderBy: { transactionTime: 'desc' },
      take: 100,
      select: {
        price: true,
        qty: true,
        transactionTime: true,
      },
    });

    const data = [];
    for (const fill of fills) {
      data.push({
        price: fill.price,
        qty: fill.qty,
        time: fill.transactionTime.getTime(),
      });
    }

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    console.log('[getTrades] error', error);
    return res.status(200).json({ ok: true, data: [] });
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
        OR: [
          { type: 'LIQUIDATION' },
          { type: 'MARKET', margin: 0 },
        ],
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
    console.log('[getLiquidations] error', error);
    return res.status(200).json({ ok: true, data: [] });
  }
}

export async function getCandles(req: Request, res: Response) {
  const parsedMarket = Shared.MARKET_AVAILABEL_SCHEMA.safeParse(req.params.marketId);
  if (!parsedMarket.success) {
    return res.status(400).json({ msg: 'invalid market' });
  }

  const interval = req.params.interval;
  if (!['1m', '5m', '15m', '1h', '1d'].includes(interval)) {
    return res.status(400).json({ msg: 'invalid interval, use 1m, 5m, 15m, 1h, or 1d' });
  }

  let limit = 200;
  if (typeof req.query.limit === 'string') {
    const n = Number(req.query.limit);
    if (n > 0) limit = Math.min(n, 1000);
  }

  const market = parsedMarket.data;

  try {
    let candles;
    const query = {
      where: { market: market as any },
      orderBy: { openTime: 'desc' as const },
      take: limit,
    };

    if (interval === '1m') {
      candles = await prisma.candle1m.findMany(query);
    } else if (interval === '5m') {
      candles = await prisma.candle5m.findMany(query);
    } else if (interval === '15m') {
      candles = await prisma.candle15m.findMany(query);
    } else if (interval === '1h') {
      candles = await prisma.candle1h.findMany(query);
    } else {
      candles = await prisma.candle1d.findMany(query);
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
    console.log('[getCandles] error', error);
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
    console.log('[getTickerPrice] error', error);
    return res.status(200).json({ ok: true, price: 0 });
  }
}

export async function getMarkPrice(req: Request, res: Response) {
  const parsed = Shared.MARKET_AVAILABEL_SCHEMA.safeParse(req.params.marketId);
  if (!parsed.success) {
    return res.status(400).json({ msg: 'invalid market' });
  }

  const cached = getCachedMarkPrice(parsed.data);
  if (cached) {
    return res.status(200).json({ ok: true, price: cached });
  }

  const depth = getCachedDepth(parsed.data);
  if (depth) {
    const bids = Array.isArray(depth.bids) ? (depth.bids as [number, number][]) : [];
    const asks = Array.isArray(depth.asks) ? (depth.asks as [number, number][]) : [];
    const bestBid = bids.length > 0 ? Math.max(...bids.map((level) => Number(level[0]))) : null;
    const bestAsk = asks.length > 0 ? Math.min(...asks.map((level) => Number(level[0]))) : null;

    if (bestBid && bestAsk && bestBid > 0 && bestAsk > 0) {
      return res.status(200).json({ ok: true, price: (bestBid + bestAsk) / 2 });
    }
    if (bestBid && bestBid > 0) {
      return res.status(200).json({ ok: true, price: bestBid });
    }
    if (bestAsk && bestAsk > 0) {
      return res.status(200).json({ ok: true, price: bestAsk });
    }
  }

  return res.status(200).json({ ok: true, price: 0 });
}
