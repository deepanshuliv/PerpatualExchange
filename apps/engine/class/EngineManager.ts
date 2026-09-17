import { connectRedisClient, redisClient, type RedisClientType } from '@repo/redis';
import { EngineRequest, EngineResponse, type RedisStreamResponse } from '@repo/shared-types';
import type { EngineSnapShotInstanceType } from '@repo/shared-types/internal-types';
import fs from 'node:fs/promises';
import path from 'node:path';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

import { allMarketsList, type MARKET_AVAILABEL } from '../../../packages/shared-types/shared';
import BinanceClassListner from './binanceListner';
import MatchingEngine from './matchingEngine';
import PostionManager from './PositionManager';

const FUNDING_INTERVAL_MS = 8 * 60 * 60 * 1000;
const SNAPSHOT_INTERVAL_MS = 3 * 1000;
const ENGINE_STREAM = process.env.ENGINE_STREAM || 'to-engine';
const BACKEND_STREAM = process.env.BACKEND_STREAM || 'to-backend';
const SNAPSHOT_DIR =
  process.env.SNAPSHOT_DIR || path.resolve(process.cwd(), 'apps/engine/snapshots');
const LOCAL_SNAPSHOT_PATH = path.join(SNAPSHOT_DIR, 'snapshot-latest.json');

const r2Endpoint = process.env.R2_ENDPOINT?.trim();
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
const r2 =
  r2Endpoint && r2AccessKeyId && r2SecretAccessKey
    ? new S3Client({
        region: 'auto',
        endpoint: r2Endpoint,
        credentials: {
          accessKeyId: r2AccessKeyId,
          secretAccessKey: r2SecretAccessKey,
        },
      })
    : null;
const R2_BUCKET = process.env.R2_BUCKET_NAME || 'perp-exchange-snapshots';

const SILENT_BROADCAST_TYPES = new Set([
  'markprice_updated',
  'depth_updated',
  'trade_executed',
  'last_traded_price_updated',
  'funding_timer_reset',
]);

const toNum = (value: string | number) => Number(value);

export default class EngineManager {
  private binanceListner: BinanceClassListner;
  private publisherRedisClient: RedisClientType;
  private subsciberRedisClient: RedisClientType;
  private positionManager: PostionManager;
  private matchingManger: MatchingEngine;
  private redisReadPointer = '';
  private fundingRateTimerStarted = false;
  private snapshotInProgress = false;

  constructor() {
    this.publisherRedisClient = redisClient.duplicate();
    this.subsciberRedisClient = redisClient.duplicate();
    this.binanceListner = new BinanceClassListner(redisClient.duplicate());
    this.positionManager = new PostionManager();
    this.matchingManger = new MatchingEngine(this.positionManager);
  }

  async sendTobackend(response: EngineResponse.ENGINE_STREAM_MESSAGE) {
    try {
      await this.publisherRedisClient.xAdd(
        BACKEND_STREAM,
        '*',
        { data: JSON.stringify(response) },
        { TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 100000 } },
      );
      if (!SILENT_BROADCAST_TYPES.has(response.type)) {
        const correlationId = 'correlationId' in response ? response.correlationId : 'N/A';
        console.log(
          `[Engine] Sent response to backend: type=${response.type} | correlationId=${correlationId}`,
        );
      }
    } catch (err) {
      console.log('[sendTobackend] error', err);
    }
  }

  private async publishMarketUpdates(
    market: MARKET_AVAILABEL,
    fills: Array<{ price: number; qty: number }> = [],
    transactionTime = Date.now(),
  ) {
    const depth = this.matchingManger.getDepth(market);

    await this.sendTobackend({
      type: 'depth_updated',
      payload: { market, bids: depth.bids, asks: depth.asks, transactionTime },
    });

    for (const fill of fills) {
      await this.sendTobackend({
        type: 'trade_executed',
        payload: { market, price: fill.price, qty: fill.qty, transactionTime },
      });
    }

    if (fills.length > 0) {
      const lastFill = fills[fills.length - 1]!;
      await this.sendTobackend({
        type: 'last_traded_price_updated',
        payload: { market, price: lastFill.price, transactionTime },
      });
    }
  }

  async handleBackendRequest(
    request: EngineRequest.ENGINE_REQUEST | EngineRequest.GET_MARKET_PRICE,
  ) {
    if ('correlationId' in request) {
      console.log(
        `[Engine] Handling RPC: type=${request.type} | correlationId=${request.correlationId}`,
      );
    }

    if (request.type === 'get_balance') {
      const { correlationId } = request;
      const { userId } = request.payload;
      const balance = this.matchingManger.getBalance(userId);

      await this.sendTobackend({
        correlationId,
        type: 'get_balance',
        payload: balance,
      });
    } else if (request.type === 'create_order') {
      const { correlationId } = request;
      const { userId, qty, market, margin, type, kind, price } = request.payload;

      const createOrder = this.matchingManger.createOrder(
        userId,
        market,
        type,
        kind,
        toNum(qty),
        toNum(price),
        toNum(margin),
      );
      if (!createOrder) {
        await this.sendTobackend({
          correlationId,
          type: 'error',
          payload: { error: 'ERROR_IN_CREATING_ORDER' },
        });
        return;
      }
      const transactionTime = Date.now();
      await this.sendTobackend({
        correlationId,
        type: 'create_order',
        payload: { ...createOrder, market, kind, userId, transactionTime },
      });
      await this.publishMarketUpdates(market, createOrder.fills ?? [], transactionTime);
    } else if (request.type === 'add_balance') {
      const { correlationId } = request;
      const { userId, amount } = request.payload;
      const nextBalance = this.matchingManger.addBalance(userId, amount);
      await this.sendTobackend({ correlationId, type: 'add_balance', payload: nextBalance });
    } else if (request.type === 'cancel_order') {
      const { correlationId } = request;
      const { userId, orderId } = request.payload;
      const cancelled = this.matchingManger.cancelOrder(userId, orderId);
      if (!cancelled) {
        await this.sendTobackend({
          correlationId,
          type: 'error',
          payload: { error: 'NOT_ABLE_TO_CANCEL' },
        });
        return;
      }
      const transactionTime = Date.now();
      await this.sendTobackend({
        correlationId,
        type: 'cancel_order',
        payload: {
          orderId: cancelled.orderId!,
          userId: cancelled.userId!,
          kind: cancelled.kind,
          market: cancelled.market,
          price: cancelled.price,
          totalQty: cancelled.totalQty!,
          filledQty: cancelled.filledQty!,
          margin: cancelled.margin,
          transactionTime,
        },
      });
      await this.publishMarketUpdates(cancelled.market, [], transactionTime);
    } else if (request.type === 'get_position') {
      const { correlationId } = request;
      const { market, userId } = request.payload;
      if (market) {
        const position = this.matchingManger.getPositionForMarket(userId, market);
        await this.sendTobackend({
          correlationId,
          type: 'get_position',
          payload: position,
        });
      } else {
        const positions = this.matchingManger.getPositions(userId);
        await this.sendTobackend({
          correlationId,
          type: 'get_position',
          payload: positions,
        });
      }
    } else if (request.type === 'get_open_orders') {
      const { correlationId } = request;
      const { market, userId } = request.payload;
      const openOrders = this.matchingManger.getOpenOrders(userId, market).map((o) => ({
        ...o,
        transactionTime: o.createdAt.getTime(),
      }));
      await this.sendTobackend({
        correlationId,
        type: 'get_open_orders',
        payload: openOrders,
      });
    } else if (request.type === 'get_fills') {
      const { correlationId } = request;
      const { userId } = request.payload;
      const fills = this.matchingManger.getFills(userId).map((f) => ({
        ...f,
        type: f.type || 'LIMIT',
        kind: f.kind || (f.buyerId === userId ? 'LONG' : 'SHORT'),
        status: f.status || 'FILLED',
        transactionTime: f.transactionTime || Date.now(),
      }));
      await this.sendTobackend({
        correlationId,
        type: 'get_fills',
        payload: fills,
      });
    } else if (request.type === 'get_depth') {
      const { correlationId } = request;
      const { market } = request.payload;
      const depth = this.matchingManger.getDepth(market);
      await this.sendTobackend({
        correlationId,
        type: 'get_depth',
        payload: depth,
      });
    } else if (request.type === 'markprice_updated') {
      const { price, market } = request.payload;

      this.positionManager.updateMarkpriceMap(market, price);

      await this.sendTobackend({
        type: 'markprice_updated',
        payload: { market, price, transactionTime: Date.now() },
      });

      const userToLiquidate = this.positionManager.calculateLiquidation(market, price);

      for (const user of userToLiquidate ?? []) {
        const { qty, margin, userId, kind, market, costBasis } = user;
        const liquidationOrder = this.matchingManger.placeMarketOrderForLiquidation(
          userId,
          kind,
          qty,
          margin,
          market,
          costBasis,
          price,
        );
        if (!liquidationOrder) continue;

        const transactionTime = Date.now();
        await this.sendTobackend({
          type: 'liquidation',
          payload: {
            orderId: liquidationOrder.orderId,
            userId,
            kind,
            market,
            filledQty: liquidationOrder.filledQty,
            totalQty: liquidationOrder.totalQty,
            totalSpent: liquidationOrder.totalSpent,
            fills: liquidationOrder.fills,
            transactionTime,
          },
        });
        await this.publishMarketUpdates(market, liquidationOrder.fills ?? [], transactionTime);
      }
    } else if (request.type === 'run_funding_rate') {
      if (!this.fundingRateTimerStarted) {
        this.fundingRateTimerStarted = true;
        setInterval(async () => {
          this.publisherRedisClient.xAdd(
            ENGINE_STREAM,
            '*',
            {
              data: JSON.stringify({ type: 'run_funding_rate' }),
            },
            { TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 100000 } },
          );
        }, FUNDING_INTERVAL_MS);
      }
      const now = Date.now();
      for (const market of allMarketsList) {
        const markPrice = this.positionManager.getMarkpriceOfMarket(market) || 0;
        const lastTradedPrice = this.matchingManger.getLastTradedPriceOFMarket(market) || 0;
        this.positionManager.claculateFundingRate(markPrice, lastTradedPrice, market);
        await this.sendTobackend({
          type: 'funding_timer_reset',
          payload: { market, transactionTime: now },
        });
      }
    } else if ('correlationId' in request) {
      await this.sendTobackend({
        correlationId: (request as { correlationId: string }).correlationId,
        type: 'error',
        payload: { error: `UNHANDLED_REQUEST_TYPE_${(request as { type: string }).type}` },
      });
    }
  }

  private async writeLocalSnapshot(jsonStr: string) {
    await fs.mkdir(SNAPSHOT_DIR, { recursive: true });
    const temporaryPath = `${LOCAL_SNAPSHOT_PATH}.${process.pid}.tmp`;

    try {
      await fs.writeFile(temporaryPath, jsonStr, 'utf8');
      await fs.rename(temporaryPath, LOCAL_SNAPSHOT_PATH);
    } catch (err) {
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
      throw err;
    }
  }

  private loadSnapshotString(raw: string, source: string) {
    type EngineSnapshotWithPointer = EngineSnapShotInstanceType & {
      redisReadPointer: string;
    };

    const parsedSnapshot = JSON.parse(raw) as EngineSnapshotWithPointer;
    if (!parsedSnapshot) return false;

    this.matchingManger.loadSnapShot(parsedSnapshot);
    this.redisReadPointer = parsedSnapshot.redisReadPointer || '';
    console.log(`[Snapshot] Loaded successfully from ${source}.`);
    return true;
  }

  async uploadSnapshotToR2(data: any) {
    if (this.snapshotInProgress) return;
    this.snapshotInProgress = true;

    try {
      const jsonStr = JSON.stringify(data);

      // The local Docker volume is the primary checkpoint. This keeps the
      // engine recoverable even when R2 is not configured or temporarily down.
      try {
        await this.writeLocalSnapshot(jsonStr);
        this.matchingManger.pruneState();
      } catch (err) {
        // Do not let a full/unwritable volume turn into unbounded process
        // memory: terminal orders are removed immediately and fills are capped
        // in OrderBookManager. The current snapshot remains the last good one.
        console.error('[Snapshot] Local snapshot write failed:', err);
        return;
      }

      if (!r2) return;

      const key = 'snapshot-latest.json';
      let retries = 3;
      let delay = 1000;
      while (retries > 0) {
        try {
          await r2.send(
            new PutObjectCommand({
              Bucket: R2_BUCKET,
              Key: key,
              Body: jsonStr,
              ContentType: 'application/json',
            }),
          );
          console.log(`[Snapshot] Successfully uploaded ${key} to R2.`);
          return;
        } catch (err) {
          retries--;
          console.error(`[Snapshot] R2 upload failed. Retries left: ${retries}`, err);
          if (retries > 0) {
            await new Promise((res) => setTimeout(res, delay));
            delay *= 2;
          }
        }
      }
    } finally {
      this.snapshotInProgress = false;
    }
  }

  async loadLatestSnapshotFromR2() {
    try {
      const localSnapshot = await fs.readFile(LOCAL_SNAPSHOT_PATH, 'utf8');
      if (this.loadSnapshotString(localSnapshot, 'the local volume')) return;
    } catch (err: any) {
      if (err?.code !== 'ENOENT') {
        console.log('[Snapshot] Local snapshot could not be loaded:', err);
      }
    }

    if (!r2) {
      console.log('[Snapshot] No local snapshot found and R2 is not configured. Starting fresh.');
      return;
    }

    console.log('[Snapshot] Attempting to load snapshot-latest.json from R2...');
    try {
      const response = await r2.send(
        new GetObjectCommand({
          Bucket: R2_BUCKET,
          Key: 'snapshot-latest.json',
        }),
      );

      const str = await response.Body?.transformToString();
      if (str) this.loadSnapshotString(str, 'R2');
    } catch (err: any) {
      if (err.name === 'NoSuchKey') {
        console.log('[Snapshot] No existing snapshot found in R2. Starting fresh.');
      } else {
        console.log('[loadLatestSnapshotFromR2] error', err);
      }
    }
  }

  async start() {
    console.log('Connecting to Redis...');
    await connectRedisClient(this.subsciberRedisClient, 'MatchingEngine-subscriber');
    await connectRedisClient(this.publisherRedisClient, 'MatchingEngine-publisher');
    console.log('Redis connected successfully.');

    console.log('waiting for binance to connect...');
    await this.binanceListner.intialize();
    console.log('connected to binance');

    console.log('loading snapshot...');
    await this.loadLatestSnapshotFromR2();
    console.log('snapshot loaded');

    if (!this.redisReadPointer) {
      const latest = await this.subsciberRedisClient.xRevRange(ENGINE_STREAM, '+', '-', {
        COUNT: 1,
      });
      this.redisReadPointer = latest[0]?.id ?? '$';
    }

    const now = Date.now();
    for (const market of allMarketsList) {
      await this.publishMarketUpdates(market, [], now);
    }
    console.log('initial market depth published');

    setInterval(async () => {
      try {
        await this.uploadSnapshotToR2({
          ...this.matchingManger.createSnapShot(),
          redisReadPointer: this.redisReadPointer,
        });
      } catch (err) {
        console.log('[uploadSnapshotToR2] error', err);
      }
    }, SNAPSHOT_INTERVAL_MS);

    while (1) {
      try {
        const readFrom = this.redisReadPointer || '$';

        const response = (await this.subsciberRedisClient.xRead(
          [{ key: ENGINE_STREAM, id: readFrom }],
          {
            BLOCK: 0,
            COUNT: 100,
          },
        )) as RedisStreamResponse;

        if (!response || !Array.isArray(response)) {
          await new Promise((res) => setTimeout(res, 50));
          continue;
        }

        for (const stream of response) {
          for (const msg of stream.messages) {
            this.redisReadPointer = msg.id;
            const parsedMessage = JSON.parse(msg.message.data!) || {};
            const type = parsedMessage.type ?? 'unknown';
            const correlationId = parsedMessage.correlationId ?? 'N/A';
            if (type !== 'markprice_updated') {
              console.log(
                `[Engine] Stream message received: type=${type} | correlationId=${correlationId}`,
              );
            }

            if (type === 'markprice_updated') {
              const { success, data, error } =
                EngineRequest.GET_MARKET_PRICE_SCHEMA.safeParse(parsedMessage);
              if (!success) {
                console.log('[start] error', error);
                continue;
              }
              try {
                await this.handleBackendRequest(data);
              } catch (err) {
                console.log(`[handleBackendRequest] error | type=markprice_updated`, err);
              }
            } else {
              const { success, data, error } =
                EngineRequest.ENGINE_REQUEST_SCHEMA.safeParse(parsedMessage);
              if (!success) {
                console.log('[start] error', error);
                continue;
              }
              try {
                await this.handleBackendRequest(data);
              } catch (err) {
                console.log(
                  `[handleBackendRequest] error | type=${type} | correlationId=${correlationId}`,
                  err,
                );
                if (
                  correlationId &&
                  correlationId !== 'N/A' &&
                  type !== 'markprice_updated' &&
                  type !== 'run_funding_rate'
                ) {
                  await this.sendTobackend({
                    correlationId,
                    type: 'error',
                    payload: {
                      error: err instanceof Error ? err.message : 'ENGINE_INTERNAL_ERROR',
                    },
                  });
                }
              }
            }
          }
        }
      } catch (err) {
        console.log('[start] error', err);
        await new Promise((res) => setTimeout(res, 1000));
      }
    }
  }
}
