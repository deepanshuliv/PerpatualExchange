import { prisma } from '@repo/db';
import { BackendRequest, EngineRequest, Shared } from '@repo/shared-types';
import crypto from 'crypto';
import type { Request, Response } from 'express';
import { sendToEngine } from '../utils/toEngine';

export async function onRamp(req: Request, res: Response) {
  const { success, data } = BackendRequest.ADD_BALANCE_SCHEMA.safeParse(req.body);

  if (!success) {
    return res.status(411).json({
      msg: 'invalid input fields',
    });
  }

  const { amount } = data.data;

  const engineRequest: EngineRequest.ADD_BALANCE = {
    correlationId: data.correlationId,
    type: data.type,
    payload: {
      userId: req.userId!,
      amount,
    },
  };

  try {
    const engineResponse = await sendToEngine(engineRequest);
    if (!engineResponse) {
      return res.status(403).json({
        msg: 'some error occured',
      });
    }

    if (engineResponse.type === 'error') {
      return res.status(400).json({
        msg: engineResponse.payload.error,
      });
    }

    res.status(201).json({
      ok: true,
      data: engineResponse.payload,
    });
  } catch (err: any) {
    return res.status(504).json({ msg: err?.message || 'Engine timeout' });
  }
}

export async function createOrder(req: Request, res: Response) {
  const { success, data } = BackendRequest.CREATE_ORDER_SCHEMA.safeParse(req.body);
  if (!success) {
    return res.status(411).json({
      msg: 'invalid input fields',
    });
  }

  const { qty, price, market, type, kind, margin } = data.data;

  const engineRequest: EngineRequest.CREATE_ORDER = {
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
  };
  try {
    const engineResponse = await sendToEngine(engineRequest);

    if (!engineResponse) {
      return res.status(403).json({
        msg: 'some error occured',
      });
    }

    if (engineResponse.type === 'error') {
      return res.status(400).json({
        msg: engineResponse.payload.error,
      });
    }

    return res.status(200).json({
      ok: true,
      data: engineResponse.payload,
    });
  } catch (err: any) {
    return res.status(504).json({ msg: err?.message || 'Engine timeout' });
  }
}

export async function cancelOrder(req: Request, res: Response) {
  const { success, data } = BackendRequest.CANCEL_ORDER_SCHEMA.safeParse(req.body);
  if (!success) {
    return res.status(411).json({
      msg: 'invalid input fields',
    });
  }

  const { orderId } = data.data;

  const engineRequest: EngineRequest.CANCEL_ORDER = {
    correlationId: data.correlationId,
    type: 'cancel_order',
    payload: {
      userId: req.userId!,
      orderId,
    },
  };
  try {
    const engineResponse = await sendToEngine(engineRequest);

    if (!engineResponse) {
      return res.status(403).json({
        msg: 'some error occured',
      });
    }

    if (engineResponse.type === 'error') {
      return res.status(400).json({
        msg: engineResponse.payload.error,
      });
    }

    return res.status(200).json({
      ok: true,
      data: engineResponse.payload,
    });
  } catch (err: any) {
    return res.status(504).json({ msg: err?.message || 'Engine timeout' });
  }
}

export async function getAvailableEquity(req: Request, res: Response) {
  const marketRaw = req.query.market as string | undefined;
  let market: Shared.MARKET_AVAILABEL | undefined;
  if (marketRaw !== undefined) {
    const parsed = Shared.MARKET_AVAILABEL_SCHEMA.safeParse(marketRaw);
    if (!parsed.success) {
      return res.status(400).json({
        msg: 'invalid market',
      });
    }
    market = parsed.data;
  }

  const engineRequest: EngineRequest.GET_BALANCE = {
    correlationId: crypto.randomUUID(),
    type: 'get_balance',
    payload: {
      userId: req.userId!,
      market,
    },
  };

  try {
    const engineResponse = await sendToEngine(engineRequest);
    if (!engineResponse) {
      return res.status(403).json({
        msg: 'some error occured',
      });
    }

    if (engineResponse.type === 'error') {
      return res.status(400).json({
        msg: engineResponse.payload.error,
      });
    }

    res.status(200).json({
      ok: true,
      data: engineResponse.payload,
    });
  } catch (err: any) {
    return res.status(504).json({ msg: err?.message || 'Engine timeout' });
  }
}

export async function getOpenPositions(req: Request, res: Response) {
  const marketId = req.params.marketId === 'all' ? undefined : req.params.marketId;
  let market: Shared.MARKET_AVAILABEL | undefined;
  if (marketId !== undefined) {
    const parsed = Shared.MARKET_AVAILABEL_SCHEMA.safeParse(marketId);
    if (!parsed.success) {
      return res.status(400).json({
        msg: 'invalid market',
      });
    }
    market = parsed.data;
  }

  const engineRequest: EngineRequest.GET_POSITION = {
    correlationId: crypto.randomUUID(),
    type: 'get_position',
    payload: {
      userId: req.userId!,
      market,
    },
  };

  try {
    const engineResponse = await sendToEngine(engineRequest);
    if (!engineResponse) {
      return res.status(403).json({
        msg: 'some error occured',
      });
    }

    if (engineResponse.type === 'error') {
      return res.status(400).json({
        msg: engineResponse.payload.error,
      });
    }

    res.status(200).json({
      ok: true,
      data: engineResponse.payload,
    });
  } catch (err: any) {
    return res.status(504).json({ msg: err?.message || 'Engine timeout' });
  }
}

export async function getOpenOrders(req: Request, res: Response) {
  let marketId = req.params.marketId;
  if (Array.isArray(marketId)) {
    marketId = marketId[0];
  }

  let market: Shared.MARKET_AVAILABEL | undefined = undefined;
  if (marketId !== undefined && marketId !== 'all') {
    const parsed = Shared.MARKET_AVAILABEL_SCHEMA.safeParse(marketId);
    if (!parsed.success) {
      return res.status(400).json({ msg: 'invalid market' });
    }
    market = parsed.data;
  }

  try {
    const userId = req.userId!;

    let orders;
    if (market) {
      orders = await prisma.order.findMany({
        where: {
          userId: userId,
          market: market as any,
        },
        orderBy: { transactionTime: 'desc' },
      });
    } else {
      orders = await prisma.order.findMany({
        where: {
          userId: userId,
        },
        orderBy: { transactionTime: 'desc' },
      });
    }

    const openOrders = [];
    for (const order of orders) {
      const isCancelled = order.status === 'CANCELLED';
      const stillHasQtyLeft = order.filledQty < order.totalQty;

      if (!isCancelled && stillHasQtyLeft) {
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
    }

    res.status(200).json({
      ok: true,
      data: openOrders,
    });
  } catch (err: any) {
    console.log('[orders/open] DB error:', err);
    return res.status(500).json({ msg: 'failed to fetch open orders' });
  }
}

export async function getFills(req: Request, res: Response) {
  const engineRequest: EngineRequest.GET_FILLS = {
    correlationId: crypto.randomUUID(),
    type: 'get_fills',
    payload: {
      userId: req.userId!,
    },
  };

  try {
    const engineResponse = await sendToEngine(engineRequest);
    if (!engineResponse) {
      return res.status(403).json({
        msg: 'some error occured',
      });
    }

    if (engineResponse.type === 'error') {
      return res.status(400).json({
        msg: engineResponse.payload.error,
      });
    }

    res.status(200).json({
      ok: true,
      data: engineResponse.payload,
    });
  } catch (err: any) {
    return res.status(504).json({ msg: err?.message || 'Engine timeout' });
  }
}

export async function getDepth(req: Request, res: Response) {
  const marketId = req.params.marketId;
  const parsed = Shared.MARKET_AVAILABEL_SCHEMA.safeParse(marketId);
  if (!parsed.success) {
    return res.status(400).json({
      msg: 'invalid market',
    });
  }
  const market = parsed.data;

  try {
    const engineRequest: EngineRequest.GET_DEPTH = {
      correlationId: crypto.randomUUID(),
      type: 'get_depth',
      payload: { market },
    };

    const engineResponse = await sendToEngine(engineRequest);
    if (!engineResponse) {
      return res.status(503).json({ msg: 'engine unavailable' });
    }

    if (engineResponse.type === 'error') {
      return res.status(400).json({ msg: engineResponse.payload.error });
    }

    if (engineResponse.type === 'get_depth') {
      return res.status(200).json({ ok: true, data: engineResponse.payload });
    }

    return res.status(500).json({ msg: 'unexpected engine response type' });
  } catch (err: any) {
    if (err?.message?.includes('Timeout')) {
      return res.status(200).json({ ok: true, data: { bids: {}, asks: {} } });
    }
    console.log('[depth] Unexpected error:', err);
    return res.status(503).json({ msg: 'engine unavailable' });
  }
}

export async function getLiquidations(req: Request, res: Response) {
  const marketId = req.params.marketId;
  const parsed = Shared.MARKET_AVAILABEL_SCHEMA.safeParse(marketId);
  if (!parsed.success) {
    return res.status(400).json({ msg: 'invalid market' });
  }
  const market = parsed.data;

  try {
    const orders = await prisma.order.findMany({
      where: {
        market: market as any,
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

    const data = orders.map((order) => ({
      userId: order.userId,
      kind: order.kind,
      price: order.price,
      qty: order.filledQty,
      totalQty: order.totalQty,
      time: order.transactionTime.getTime(),
    }));

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    console.log('[liquidations] DB error:', error);
    return res.status(200).json({ ok: true, data: [] });
  }
}

export async function getTickerPrice(req: Request, res: Response) {
  const marketId = req.params.marketId;
  const parsed = Shared.MARKET_AVAILABEL_SCHEMA.safeParse(marketId);
  if (!parsed.success) {
    return res.status(400).json({ msg: 'invalid market' });
  }
  const market = parsed.data;

  try {
    const lastFill = await prisma.fill.findFirst({
      where: {
        order: {
          market: market as any,
        },
      },
      orderBy: {
        transactionTime: 'desc',
      },
      select: {
        price: true,
      },
    });

    let price = 0;
    if (lastFill) {
      price = lastFill.price;
    }

    return res.status(200).json({
      ok: true,
      price: price,
    });
  } catch (error) {
    console.log('[ticker/price] DB error:', error);
    return res.status(200).json({ ok: true, price: 0 });
  }
}
