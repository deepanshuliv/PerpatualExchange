import crypto from 'crypto';
import { connectRedisClient, redisClient } from '@repo/redis';
import { Shared } from '@repo/shared-types';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const ENGINE_STREAM = process.env.ENGINE_STREAM || 'to-engine';

/** Engine-only sim user for load tests — no Prisma/DB required. */
export async function provisionSimUser(req: Request, res: Response) {
  const amount = Number(req.body?.amount);
  const onrampAmount = Number.isFinite(amount) && amount > 0 ? amount : 10_000;
  const label =
    typeof req.body?.label === 'string' && req.body.label.trim()
      ? req.body.label.trim()
      : `sim_${Date.now()}`;

  const userId = crypto.randomUUID();

  try {
    await connectRedisClient(redisClient, 'Sim-Provision');
    await redisClient.xAdd(ENGINE_STREAM, '*', {
      data: JSON.stringify({
        correlationId: crypto.randomUUID(),
        type: 'add_balance',
        payload: { userId, amount: onrampAmount },
      }),
    });

    const token = jwt.sign({ userId }, process.env.JWT_SECRET!);

    return res.status(201).json({
      ok: true,
      token,
      userId,
      user: { id: userId, username: label },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to provision sim user';
    return res.status(503).json({ msg: message });
  }
}

/** Push a mark price into the engine to trigger liquidations during sim runs. */
export async function injectMarkPrice(req: Request, res: Response) {
  const parsedMarket = Shared.MARKET_AVAILABEL_SCHEMA.safeParse(req.body?.market);
  const price = Number(req.body?.price);

  if (!parsedMarket.success || !Number.isFinite(price) || price <= 0) {
    return res.status(400).json({ msg: 'invalid market or price' });
  }

  try {
    await connectRedisClient(redisClient, 'Sim-MarkPrice');
    await redisClient.xAdd(ENGINE_STREAM, '*', {
      data: JSON.stringify({
        type: 'markprice_updated',
        payload: { market: parsedMarket.data, price },
      }),
    });

    return res.status(200).json({
      ok: true,
      market: parsedMarket.data,
      price,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to inject mark price';
    return res.status(503).json({ msg: message });
  }
}
