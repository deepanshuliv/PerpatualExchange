import { connectRedisClient, redisClient, type RedisClientType } from '@repo/redis';
import {
  EngineResponse,
  type EngineRequest,
  type RedisStreamResponse,
  type Shared,
} from '@repo/shared-types';

const ENGINE_STREAM = process.env.ENGINE_STREAM || 'to-engine';
const BACKEND_STREAM = process.env.BACKEND_STREAM || 'to-backend';
const RPC_TIMEOUT_MS = 2_000;

export class EngineClient {
  private publisher: RedisClientType;
  private subscriber: RedisClientType;
  private correlationMap = new Map<
    string,
    {
      resolve: (value: EngineResponse.ENGINE_STREAM_MESSAGE) => void;
      reject: (err: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private markPrices = new Map<string, number>();
  private priceCallbacks = new Set<(market: Shared.MARKET_AVAILABEL, price: number) => void>();

  constructor() {
    this.publisher = redisClient.duplicate();
    this.subscriber = redisClient.duplicate();
  }

  async init(): Promise<void> {
    await Promise.all([
      connectRedisClient(this.publisher, 'MarketMaker-Publisher'),
      connectRedisClient(this.subscriber, 'MarketMaker-Subscriber'),
    ]);

    this.startStreamListener().catch((err) => {
      console.error('[EngineClient] Stream listener crashed:', err);
    });
  }

  onMarkPriceUpdate(callback: (market: Shared.MARKET_AVAILABEL, price: number) => void) {
    this.priceCallbacks.add(callback);
    return () => this.priceCallbacks.delete(callback);
  }

  getLatestMarkPrice(market: string): number | null {
    return this.markPrices.get(market) ?? null;
  }

  private async startStreamListener() {
    const latest = await this.subscriber.xRevRange(BACKEND_STREAM, '+', '-', { COUNT: 1 });
    let lastId = latest[0]?.id ?? '$';

    while (true) {
      try {
        const response = (await this.subscriber.xRead([{ key: BACKEND_STREAM, id: lastId }], {
          COUNT: 100,
          BLOCK: 0,
        })) as RedisStreamResponse;

        if (!response || !Array.isArray(response)) {
          continue;
        }

        for (const stream of response) {
          for (const msg of stream.messages) {
            lastId = msg.id;
            try {
              const parsed = JSON.parse(msg.message.data ?? '{}');
              this.handleStreamMessage(parsed);
            } catch (parseErr) {
              console.error('[EngineClient] JSON parse error on stream message:', parseErr);
            }
          }
        }
      } catch (err) {
        console.error('[EngineClient] Error in stream reader loop:', err);
        await new Promise((res) => setTimeout(res, 1000));
      }
    }
  }

  private handleStreamMessage(msg: any) {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'markprice_updated' && msg.payload?.market && msg.payload?.price) {
      const market = msg.payload.market as Shared.MARKET_AVAILABEL;
      const price = Number(msg.payload.price);
      if (Number.isFinite(price) && price > 0) {
        this.markPrices.set(market, price);
        for (const cb of this.priceCallbacks) {
          cb(market, price);
        }
      }
    }

    if ('correlationId' in msg && msg.correlationId) {
      const pending = this.correlationMap.get(msg.correlationId);
      if (pending) {
        clearTimeout(pending.timer);
        this.correlationMap.delete(msg.correlationId);
        pending.resolve(msg);
      }
    }
  }

  async sendRequest<T = any>(
    request: EngineRequest.ENGINE_REQUEST,
    waitForResponse = true,
  ): Promise<T | null> {
    if (!waitForResponse) {
      await this.publisher.xAdd(ENGINE_STREAM, '*', { data: JSON.stringify(request) });
      return null;
    }

    return new Promise((resolve, reject) => {
      const correlationId = 'correlationId' in request ? request.correlationId : '';
      if (!correlationId) {
        this.publisher
          .xAdd(ENGINE_STREAM, '*', { data: JSON.stringify(request) })
          .then(() => resolve(null as unknown as T))
          .catch(reject);
        return;
      }

      const timer = setTimeout(() => {
        this.correlationMap.delete(correlationId);
        reject(new Error(`Timeout waiting for correlationId: ${correlationId}`));
      }, RPC_TIMEOUT_MS);

      this.correlationMap.set(correlationId, {
        resolve: (resp) => resolve(resp as unknown as T),
        reject,
        timer,
      });

      this.publisher.xAdd(ENGINE_STREAM, '*', { data: JSON.stringify(request) }).catch((err) => {
        const pending = this.correlationMap.get(correlationId);
        if (pending) {
          clearTimeout(pending.timer);
          this.correlationMap.delete(correlationId);
        }
        reject(err);
      });
    });
  }

  async ensureBalance(userId: string, targetBalance: number, minThreshold: number): Promise<void> {
    try {
      const correlationId = `mm-bal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const req: EngineRequest.ENGINE_REQUEST = {
        type: 'get_balance',
        correlationId,
        payload: { userId },
      };
      const response: any = await this.sendRequest(req, true);
      const balance = response?.payload?.balance ?? response?.payload ?? 0;

      if (balance < minThreshold) {
        const topupAmount = targetBalance - balance;
        const addCorrelationId = `mm-addbal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        await this.sendRequest(
          {
            type: 'add_balance',
            correlationId: addCorrelationId,
            payload: { userId, amount: Math.max(topupAmount, targetBalance) },
          },
          true,
        );
        console.log(`[EngineClient] Auto-replenished ${userId}: added $${Math.max(topupAmount, targetBalance)}`);
      }
    } catch (err) {
      console.warn(`[EngineClient] Error checking/ensuring balance for ${userId}:`, err);
    }
  }

  async getOpenOrders(userId: string, market: Shared.MARKET_AVAILABEL): Promise<any[]> {
    try {
      const correlationId = `mm-orders-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const resp: any = await this.sendRequest(
        {
          type: 'get_open_orders',
          correlationId,
          payload: { userId, market },
        },
        true,
      );
      return Array.isArray(resp?.payload) ? resp.payload : [];
    } catch (err) {
      return [];
    }
  }

  async cancelOrder(userId: string, orderId: string): Promise<void> {
    const correlationId = `mm-cancel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await this.sendRequest(
      {
        type: 'cancel_order',
        correlationId,
        payload: { userId, orderId },
      },
      false, // fire and forget for maximum throughput
    );
  }

  async placeLimitOrder(
    userId: string,
    market: Shared.MARKET_AVAILABEL,
    kind: Shared.KIND,
    qty: number,
    price: number,
    margin: number,
  ): Promise<void> {
    const correlationId = `mm-order-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await this.sendRequest(
      {
        type: 'create_order',
        correlationId,
        payload: {
          userId,
          market,
          kind,
          type: 'LIMIT',
          qty: String(qty),
          price: String(price),
          margin: String(margin),
        },
      },
      false, // async order dispatch to minimize requote delay
    );
  }
}
