import { connectRedisClient, redisClient, type RedisClientType } from '@repo/redis';
import { EngineRequest, EngineResponse, type RedisStreamResponse } from '@repo/shared-types';
import type { EngineSnapShotInstanceType } from '@repo/shared-types/internal-types';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  allMarketsList,
  type MARKET_AVAILABEL,
} from '../../../packages/shared-types/shared';
import BinanceClassListner from './binanceListner';
import MatchingEngine from './matchingEngine';
import PostionManager from './PositionManager';

const FUNDING_INTERVAL_MS = 8 * 60 * 60 * 1000;
const SNAPSHOT_INTERVAL_MS = 8 * 60 * 60 * 1000;
const RPC_REPLAY_WINDOW_MS = 60_000;
const ENGINE_STREAM = process.env.ENGINE_STREAM || 'to-engine';
const BACKEND_STREAM = process.env.BACKEND_STREAM || 'to-backend';

/** Redis stream IDs are `{ms}-{seq}`; compare by timestamp then sequence. */
function compareStreamIds(a: string, b: string) {
  const [aMs = '0', aSeq = '0'] = a.split('-');
  const [bMs = '0', bSeq = '0'] = b.split('-');
  const msDiff = Number(aMs) - Number(bMs);
  if (msDiff !== 0) return msDiff;
  return Number(aSeq) - Number(bSeq);
}

const SILENT_BROADCAST_TYPES = new Set([
  'markprice_updated',
  'depth_updated',
  'trade_executed',
  'last_traded_price_updated',
  'funding_timer_reset',
]);

const toNum = (value: string | number) => Number(value);

const RPC_REQUEST_TYPES = new Set([
  'add_balance',
  'create_order',
  'cancel_order',
  'get_balance',
  'get_position',
  'get_open_orders',
  'get_fills',
  'get_depth',
]);

export default class EngineManager {
  private binanceListner: BinanceClassListner;
  private publisherRedisClient: RedisClientType;
  private subsciberRedisClient: RedisClientType;
  private positionManager: PostionManager;
  private matchingManger: MatchingEngine;
  private redisReadPointer = '';
  private fundingRateTimerStarted = false;

  constructor() {
    this.publisherRedisClient = redisClient.duplicate();
    this.subsciberRedisClient = redisClient.duplicate();
    this.binanceListner = new BinanceClassListner(redisClient.duplicate());
    this.positionManager = new PostionManager();
    this.matchingManger = new MatchingEngine(this.positionManager);
  }

  async sendTobackend(response: EngineResponse.ENGINE_STREAM_MESSAGE) {
    try {
      await this.publisherRedisClient.xAdd(BACKEND_STREAM, '*', { data: JSON.stringify(response) });
      if (!SILENT_BROADCAST_TYPES.has(response.type)) {
        const correlationId = 'correlationId' in response ? response.correlationId : 'N/A';
        console.log(
          `[Engine] Sent response to backend: type=${response.type} | correlationId=${correlationId}`,
        );
      }
    } catch (err) {
      console.log('[Engine] Failed to publish to backend stream:', err);
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

  async handleBackendRequest(request: EngineRequest.ENGINE_REQUEST | EngineRequest.GET_MARKET_PRICE) {
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
    } else if (request.type === 'get_fills') {
      const { correlationId } = request;
      const { userId } = request.payload;
      const fills = this.matchingManger.getFills(userId);
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
    } else if (request.type === 'get_open_orders') {
      const { correlationId } = request;
      const { userId, market } = request.payload;
      const orders = this.matchingManger.getOpenOrders(userId, market);
      await this.sendTobackend({
        correlationId,
        type: 'get_open_orders',
        payload: orders.map((o) => ({
          ...o,
          transactionTime: o.createdAt.getTime(),
        })),
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
          this.publisherRedisClient.xAdd(ENGINE_STREAM, '*', {
            data: JSON.stringify({ type: 'run_funding_rate' }),
          });
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
    }
  }

  async addSnapShotInFile(data: any) {
    const path = await this.getSnapShotFolderPath();
    const date = Date.now();
    await fs.writeFile(`${path}/${date}.txt`, JSON.stringify(data));
  }

  async loadLatestSnapShotfromFile() {
    const pathLocation = await this.getSnapShotFolderPath();

    const files = await fs.readdir(pathLocation);
    if (files.length === 0) {
      return null;
    }

    let latestFile = '';
    let latestTimestamp = 0;

    for (const file of files) {
      const stringDate = file.split('.')[0];
      const timestamp = Number(stringDate);
      if (!isNaN(timestamp) && latestTimestamp < timestamp) {
        latestTimestamp = timestamp;
        latestFile = file;
      }
    }

    if (!latestFile) {
      return null;
    }

    const latestFilePathName = path.join(pathLocation, latestFile);
    console.log('[LATEST_FILEPATH]', latestFilePathName);

    try {
      const data = await fs.readFile(latestFilePathName, 'utf8');
      type EngineSnapshotWithPointer = EngineSnapShotInstanceType & {
        redisReadPointer: string;
      };
      const parsedSnapShot = JSON.parse(data || '{}') as EngineSnapshotWithPointer;
      if (parsedSnapShot) {
        this.matchingManger.loadSnapShot(parsedSnapShot);
        this.redisReadPointer = parsedSnapShot.redisReadPointer || '';
      }
    } catch (err) {
      console.log('[EngineManager] Error loading snapshot file:', err);
    }
  }

  async getSnapShotFolderPath() {
    const currentFilePath = import.meta.dir;
    const rootFolder = path.join(currentFilePath, '..');
    const destinationFolder = path.join(rootFolder, 'snapshots');

    try {
      await fs.stat(destinationFolder);
    } catch (error) {
      await fs.mkdir(destinationFolder, { recursive: true });
    }

    return destinationFolder;
  }

  /**
   * On startup, replay only recent RPC messages (last ~60s) that arrived while
   * the engine was down. Replaying the full gap since the last 8h snapshot
   * blocks the consumer for minutes and causes live requests to 504.
   */
  async prepareStreamConsumer() {
    const latest = await this.subsciberRedisClient.xRevRange(ENGINE_STREAM, '+', '-', {
      COUNT: 1,
    });
    if (!latest[0]) {
      this.redisReadPointer = '';
      return;
    }

    const latestId = latest[0].id;
    const recentCutoff = `${Date.now() - RPC_REPLAY_WINDOW_MS}-0`;
    let fromId = recentCutoff;

    if (this.redisReadPointer && compareStreamIds(this.redisReadPointer, recentCutoff) > 0) {
      fromId = this.redisReadPointer;
    }

    const messages = await this.subsciberRedisClient.xRange(ENGINE_STREAM, fromId, latestId);
    let replayed = 0;

    for (const msg of messages) {
      if (this.redisReadPointer && msg.id === this.redisReadPointer) continue;

      try {
        const parsed = JSON.parse(msg.message.data ?? '{}');
        if (!RPC_REQUEST_TYPES.has(parsed.type)) continue;

        const { success, data } = EngineRequest.ENGINE_REQUEST_SCHEMA.safeParse(parsed);
        if (!success) continue;

        await this.handleBackendRequest(data);
        replayed++;
      } catch (err) {
        console.log('[Engine] Failed to replay RPC since snapshot:', err);
      }
    }

    this.redisReadPointer = latestId;
    console.log(
      `[Engine] Stream consumer ready after ${this.redisReadPointer} (replayed ${replayed} RPC)`,
    );
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
    await this.loadLatestSnapShotfromFile();
    console.log('snapshot loaded');

    await this.prepareStreamConsumer();

    const now = Date.now();
    for (const market of allMarketsList) {
      await this.publishMarketUpdates(market, [], now);
    }
    console.log('initial market depth published');

    setInterval(async () => {
      try {
        await this.addSnapShotInFile({
          ...this.matchingManger.createSnapShot(),
          redisReadPointer: this.redisReadPointer,
        });
      } catch (err) {
        console.log('[Engine] Failed to write snapshot:', err);
      }
    }, SNAPSHOT_INTERVAL_MS);

    while (1) {
      try {
        const readFrom = this.redisReadPointer === '' ? '$' : this.redisReadPointer;

        const response = (await this.subsciberRedisClient.xRead(
          [{ key: ENGINE_STREAM, id: readFrom }],
          {
            BLOCK: 0,
            COUNT: 100,
          },
        )) as RedisStreamResponse;

        if (!response || !Array.isArray(response)) {
          continue;
        }

        for (const stream of response) {
          for (const msg of stream.messages) {
            this.redisReadPointer = msg.id;
            const parsedMessage = JSON.parse(msg.message.data!) || {};
            const type = parsedMessage.type;
            const correlationId = parsedMessage.correlationId;
            if (type !== 'markprice_updated') {
              console.log(
                `[Engine] Stream message received: type=${type} | correlationId=${correlationId}`,
              );
            }

            if (type === 'markprice_updated') {
              const { success, data, error } =
                EngineRequest.GET_MARKET_PRICE_SCHEMA.safeParse(parsedMessage);
              if (!success) {
                console.log(`[Engine] Schema validation failed for markprice_updated:`, error);
                continue;
              }
              void this.handleBackendRequest(data).catch((err) =>
                console.log('[Engine] Error handling markprice_updated:', err),
              );
            } else {
              const { success, data, error } =
                EngineRequest.ENGINE_REQUEST_SCHEMA.safeParse(parsedMessage);
              if (!success) {
                console.log(
                  `[Engine] Schema validation failed for message type=${type} | correlationId=${correlationId}:`,
                  error,
                );
                continue;
              }
              try {
                await this.handleBackendRequest(data);
              } catch (err) {
                console.log(
                  `[Engine] Error handling message type=${type} | correlationId=${correlationId}:`,
                  err,
                );
                if (correlationId && type !== 'markprice_updated' && type !== 'run_funding_rate') {
                  await this.sendTobackend({
                    correlationId,
                    type: 'error',
                    payload: { error: 'ENGINE_INTERNAL_ERROR' },
                  });
                }
              }
            }
          }
        }
      } catch (err) {
        console.log('[Engine] Error in stream consumer loop:', err);
        await new Promise((res) => setTimeout(res, 1000));
      }
    }
  }
}
