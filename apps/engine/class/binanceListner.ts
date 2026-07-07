import { connectRedisClient, type RedisClientType } from '@repo/redis';
import WebSocket from 'ws';

const STREAM_URL =
  process.env.BINANCE_STREAM_URL ||
  'wss://stream.binancefuture.com/stream?streams=btcusdt@markPrice@1s/solusdt@markPrice@1s/ethusdt@markPrice@1s';

const ENGINE_STREAM = process.env.ENGINE_STREAM || 'to-engine';

export default class BinanceClassListner {
  private redisClient: RedisClientType;

  constructor(redisClient: RedisClientType) {
    this.redisClient = redisClient;
  }

  async intialize(): Promise<void> {
    await connectRedisClient(this.redisClient, 'BinancePriceListener');
    return new Promise<void>((resolve, reject) => {
      this.setupPriceSubscription(resolve, reject);
    });
  }

  setupPriceSubscription(resolve?: () => void, reject?: (err: Error) => void) {
    const ws = new WebSocket(STREAM_URL);

    ws.on('open', () => {
      console.log('binance ws connected (stream.binancefuture.com)');
      if (resolve) {
        resolve();
      }
    });

    ws.on('error', (err) => {
      console.log('binance ws error:', err.message);
      if (reject) {
        reject(err);
      }
    });

    ws.on('close', (code) => {
      console.log('binance ws closed, reconnecting in 3s...', code);
      setTimeout(() => this.setupPriceSubscription(), 3000);
    });

    ws.on('message', async (raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        const data = parsed.data || {};
        if (!data.s || !data.p) return;

        const rawSymbol = String(data.s).toUpperCase();
        let market = '';
        if (rawSymbol === 'BTCUSDT') market = 'BTCUSD';
        else if (rawSymbol === 'ETHUSDT') market = 'ETHUSD';
        else if (rawSymbol === 'SOLUSDT') market = 'SOLUSD';
        else market = rawSymbol;

        await this.redisClient.xAdd(ENGINE_STREAM, '*', {
          data: JSON.stringify({
            type: 'markprice_updated',
            payload: { price: Number(data.p), market },
          }),
        });
      } catch (err) {
        console.log('Failed to parse or process Binance message:', err);
      }
    });
  }
}
