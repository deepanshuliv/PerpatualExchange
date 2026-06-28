import { connectRedisClient, redisClient, type RedisClientType } from '@repo/redis';
import { EngineRequest, EngineResponse } from '@repo/shared-types';
import type { EngineSnapShotInstanceType } from '@repo/shared-types/internal-types';
import fs from 'node:fs/promises';
import path from 'node:path';
import { allMarketsList, type KIND } from '../../../packages/shared-types/shared';
import BinanceClassListner from './binanceListner';
import MatchingEngine from './matchingEngine';
import PostionManager from './PositionManager';

export default class EngineManager {
  private binanceListner: BinanceClassListner;
  private publisherRedisClient: RedisClientType;
  private subsciberRedisClient: RedisClientType;
  private positionManager: PostionManager;
  private matchingManger: MatchingEngine;
  private redisReadPointer = '';

  constructor() {
    this.publisherRedisClient = redisClient.duplicate();
    this.subsciberRedisClient = redisClient.duplicate();
    this.binanceListner = new BinanceClassListner(redisClient.duplicate());
    this.positionManager = new PostionManager();
    this.matchingManger = new MatchingEngine(this.positionManager);
  }

  async sendTobackend(response: EngineResponse.ENGINE_RESPONSE) {
    const publisher = await connectRedisClient(
      this.publisherRedisClient,
      'MatchingEngine-publisher',
    );

    await publisher.xAdd('to-backend', '*', { data: JSON.stringify(response) });
    if (response.type !== 'markprice_updated' && response.type !== 'bookticker_updated') {
      const correlationId = 'correlationId' in response ? response.correlationId : 'N/A';
      console.log(
        `[Engine] Sent response to backend: type=${response.type} | correlationId=${correlationId}`,
      );
    }
  }

  handleBackendRequest(request: EngineRequest.ENGINE_REQUEST | EngineRequest.GET_MARKET_PRICE) {
    if (request.type === 'get_balance') {
      const { correlationId } = request;
      const { market, userId } = request.payload;
      const balance = this.matchingManger.getBalance(userId, market);
      const numericBalance = typeof balance === 'number' ? balance : null;
      
      this.sendTobackend({
        correlationId,
        type: 'get_balance',
        payload: numericBalance,
      });
    } else if (request.type === 'create_order') {
      const { correlationId } = request;
      const { userId, qty, market, margin, type, kind, price } = request.payload;
      const createOrder = this.matchingManger.createOrder(
        userId,
        market,
        type,
        kind,
        qty,
        price,
        margin,
      );
      if (!createOrder) {
        this.sendTobackend({
          correlationId,
          type: 'error',
          payload: { error: 'ERROR_IN_CREATING_ORDER' },
        });
        return;
      }
      this.sendTobackend({
        correlationId,
        type: 'create_order',
        payload: { ...createOrder, market, kind, userId, transactionTime: Date.now() },
      });

      const depth = this.matchingManger.getDepth(market);
      const bestBid = depth.bids[0] || [0, 0];
      const bestAsk = depth.asks[0] || [0, 0];
      this.sendTobackend({
        type: 'bookticker_updated',
        payload: {
          market,
          bestBidPrice: bestBid[0],
          bestBidQty: bestBid[1],
          bestAskPrice: bestAsk[0],
          bestAskQty: bestAsk[1],
          transactionTime: Date.now(),
        },
      });
    } else if (request.type === 'add_balance') {
      const { correlationId } = request;
      const { userId, amount } = request.payload;
      // TODO ask should i return a string acknowledge mesaage
      this.matchingManger.addBalance(userId, amount);
      this.sendTobackend({ correlationId, type: 'add_balance', payload: null });
    } else if (request.type === 'cancel_order') {
      const { correlationId } = request;
      const { userId, orderId } = request.payload;
      const cancelled = this.matchingManger.cancelOrder(userId, orderId);
      if (!cancelled) {
        this.sendTobackend({
          correlationId,
          type: 'error',
          payload: { error: 'NOT_ABLE_TO_CANCEL' },
        });
        return;
      }
      this.sendTobackend({
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
          transactionTime: Date.now(),
        },
      });

      const market = cancelled.market;
      const depth = this.matchingManger.getDepth(market);
      const bestBid = depth.bids[0] || [0, 0];
      const bestAsk = depth.asks[0] || [0, 0];
      this.sendTobackend({
        type: 'bookticker_updated',
        payload: {
          market,
          bestBidPrice: bestBid[0],
          bestBidQty: bestBid[1],
          bestAskPrice: bestAsk[0],
          bestAskQty: bestAsk[1],
          transactionTime: Date.now(),
        },
      });
    } else if (request.type === 'get_position') {
      const { correlationId } = request;
      const { market, userId } = request.payload;
      if (market) {
        const position = this.matchingManger.getPosition(userId, market);
        this.sendTobackend({
          correlationId,
          type: 'get_position',
          payload: position,
        });
      } else {
        const positions = this.matchingManger.getPositions(userId);
        this.sendTobackend({
          correlationId,
          type: 'get_position',
          payload: positions,
        });
      }
    } else if (request.type === 'get_open_orders') {
      const { correlationId } = request;
      const { market, userId } = request.payload;
      const openOrders = this.matchingManger.getOpenOrders(userId, market);
      this.sendTobackend({
        correlationId,
        type: 'get_open_orders',
        payload: openOrders,
      });
    } else if (request.type === 'get_closed_orders') {
      const { correlationId } = request;
      const { market, userId } = request.payload;
      const closedOrders = this.matchingManger.getClosedOrders(userId, market);
      this.sendTobackend({
        correlationId,
        type: 'get_closed_orders',
        payload: closedOrders,
      });
    } else if (request.type === 'get_depth') {
      const { correlationId } = request;
      const { market } = request.payload;
      const depth = this.matchingManger.getDepth(market);
      this.sendTobackend({
        correlationId,
        type: 'get_depth',
        payload: depth,
      });
    } else if (request.type === 'markprice_updated') {
      const { price, market } = request.payload;

      this.positionManager.updateMarkpriceMap(market, price);

      const userToLiquidate = this.positionManager.calculateLiquidation(market, price);

      userToLiquidate?.forEach((user) => {
        const { qty, margin, userId, kind, market, costBasis } = user;
        const liquidationOrder = this.matchingManger.palceMarketOrderForLiquidation(
          userId,
          kind,
          qty,
          margin,
          market,
          costBasis,
          price,
        );
        if (!liquidationOrder) return;

        this.sendTobackend({
          type: 'liquidation',
          payload: {
            orderId: liquidationOrder.orderId,
            userId,
            kind: liquidationOrder.kind as KIND,
            market,
            filledQty: liquidationOrder.filledQty,
            totalQty: liquidationOrder.totalQty,
            totalSpent: liquidationOrder.totalSpent,
            fills: liquidationOrder.fills,
            transactionTime: Date.now(),
          },
        });

        const depth = this.matchingManger.getDepth(market);
        const bestBid = depth.bids[0] || [0, 0];
        const bestAsk = depth.asks[0] || [0, 0];
        this.sendTobackend({
          type: 'bookticker_updated',
          payload: {
            market,
            bestBidPrice: bestBid[0],
            bestBidQty: bestBid[1],
            bestAskPrice: bestAsk[0],
            bestAskQty: bestAsk[1],
            transactionTime: Date.now(),
          },
        });
      });
    } else if (request.type === 'run_funding_rate') {
      // push to stream
      setInterval(
        async () => {
          const publisher = await this.publisherRedisClient.connect();
          publisher.xAdd('to-engine', '*', {
            data: JSON.stringify({ type: 'run_funding_rate' }),
          });
        },
        8 * 60 * 60 * 1000,
      ); // 8hr timer
      // run funding rate
      allMarketsList.forEach((market) => {
        const markPrice = this.positionManager.getMarkpriceOfMarket(market) || 0;
        const lastTradedPrice = this.matchingManger.getLastTradedPriceOFMarket(market) || 0;
        this.positionManager.claculateFundingRate(markPrice, lastTradedPrice, market);
      });
    }
  }

  async addSnapShotInFile(data: any) {
    const path = await this.getSnapShotFolderPath();
    const date = Date.now();
    await fs.writeFile(`${path}/${date}.txt`, JSON.stringify(data));
  }

  async loadLatestSnapShotfromFile() {
    //
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
      console.error('[EngineManager] Error loading snapshot file:', err);
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

  async start() {
    console.log('Connecting to Redis...');
    const subscriber = await connectRedisClient(
      this.subsciberRedisClient,
      'MatchingEngine-subscriber',
    );
    console.log('Redis connected successfully.');

    console.log('waiting for binance to connect...');
    await this.binanceListner.intialize();
    console.log('connected to binance');

    console.log('loading snapshot...');
    await this.loadLatestSnapShotfromFile();
    console.log('snapshot loaded');

    setInterval(
      async () => {
        await this.addSnapShotInFile({
          ...this.matchingManger.createSnapShot(),
          redisReadPointer: this.redisReadPointer,
        });
      },
      8000 * 60, // 8 hour
    );

    //read if availabel startpointer else from start
    while (1) {
      const readFrom = this.redisReadPointer === '' ? '$' : this.redisReadPointer;

      const response = await subscriber.xRead([{ key: 'to-engine', id: readFrom }], {
        BLOCK: 0,
        COUNT: 100,
      });

      if (!response) {
        continue;
      }
      // loop to read msga and give to handler
      for (const stream of response) {
        for (const msg of stream.messages) {
          this.redisReadPointer = msg.id;
          const parsedMessage = JSON.parse(msg.message.data!) || {};
          const type = parsedMessage.type || 'unknown';
          const correlationId = parsedMessage.correlationId || 'N/A';
          if (type !== 'markprice_updated') {
            console.log(
              `[Engine] Stream message received: type=${type} | correlationId=${correlationId}`,
            );
          }

          if (type === 'markprice_updated') {
            const { success, data, error } =
              EngineRequest.GET_MARKET_PRICE_SCHEMA.safeParse(parsedMessage);
            if (!success) {
              console.error(`[Engine] Schema validation failed for markprice_updated:`, error);
              continue;
            }
            this.handleBackendRequest(data);
          } else {
            const { success, data, error } =
              EngineRequest.ENGINE_REQUEST_SCHEMA.safeParse(parsedMessage);
            if (!success) {
              console.error(
                `[Engine] Schema validation failed for message type=${type} | correlationId=${correlationId}:`,
                error,
              );
              continue;
            }
            this.handleBackendRequest(data);
          }
        }
      }
    }
  }
}
