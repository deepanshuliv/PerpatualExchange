import type { Shared } from '@repo/shared-types';
import type { EngineClient } from './client';
import type { MarketConfig } from './config';

export class MarketMakerStrategy {
  private config: MarketConfig;
  private client: EngineClient;
  private userId: string;
  private takerUserId: string;
  private isRunning = false;
  private requoteTimer: ReturnType<typeof setInterval> | null = null;
  private tradeTimer: ReturnType<typeof setInterval> | null = null;
  private tradeCounter = 0;

  constructor(config: MarketConfig, client: EngineClient) {
    this.config = config;
    this.client = client;
    this.userId = `mm-bot-${config.market}`;
    this.takerUserId = `taker-bot-${config.market}`;
  }

  async start(initialBalance: number, minBalanceThreshold: number, requoteIntervalMs: number): Promise<void> {
    this.isRunning = true;
    console.log(`[MM Strategy: ${this.config.market}] Initializing for bot users: ${this.userId} & ${this.takerUserId}`);

    // Ensure initial balances for both maker and taker
    await this.client.ensureBalance(this.userId, initialBalance, minBalanceThreshold);
    await this.client.ensureBalance(this.takerUserId, initialBalance, minBalanceThreshold);

    // Run 1-second limit order requote loop (provides depth)
    this.requoteTimer = setInterval(() => {
      this.requote().catch((err) => {
        console.error(`[MM Strategy: ${this.config.market}] Requote error:`, err);
      });
    }, requoteIntervalMs);

    // Run active organic trade loop (executes trades, builds candles, updates volume & last price)
    this.tradeTimer = setInterval(() => {
      this.executeOrganicTrade().catch((err) => {
        console.error(`[MM Strategy: ${this.config.market}] Trade execution error:`, err);
      });
    }, 2500);

    // Initial immediate requote and trade
    setTimeout(() => this.requote(), 400);
    setTimeout(() => this.executeOrganicTrade(), 1200);
  }

  stop(): void {
    this.isRunning = false;
    if (this.requoteTimer) {
      clearInterval(this.requoteTimer);
      this.requoteTimer = null;
    }
    if (this.tradeTimer) {
      clearInterval(this.tradeTimer);
      this.tradeTimer = null;
    }
  }

  private round(val: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(val * factor) / factor;
  }

  private async requote(): Promise<void> {
    if (!this.isRunning) return;

    const markPrice = this.client.getLatestMarkPrice(this.config.market);
    if (!markPrice || markPrice <= 0) {
      return;
    }

    // 1. Fetch current open orders to cancel stale ones
    const openOrders = await this.client.getOpenOrders(this.userId, this.config.market);
    for (const order of openOrders) {
      if (order.orderId) {
        await this.client.cancelOrder(this.userId, order.orderId);
      }
    }

    // 2. Generate and place new bid and ask levels
    const { levels, spreadPercent, baseQty, qtyVariance, marginRatio, priceDecimals, qtyDecimals } = this.config;

    for (let i = 1; i <= levels; i++) {
      // Calculate jittered quantity
      const jitter = (Math.random() * 2 - 1) * qtyVariance;
      const levelQty = Math.max(
        this.round(baseQty * (1 + jitter) * (1 + i * 0.1), qtyDecimals),
        Math.pow(10, -qtyDecimals),
      );

      // Bid level (Buy limit)
      const bidPrice = this.round(markPrice * (1 - spreadPercent * i), priceDecimals);
      if (bidPrice > 0) {
        const bidMargin = this.round(levelQty * bidPrice * marginRatio, 2);
        await this.client.placeLimitOrder(
          this.userId,
          this.config.market,
          'LONG',
          levelQty,
          bidPrice,
          bidMargin,
        );
      }

      // Ask level (Sell limit)
      const askPrice = this.round(markPrice * (1 + spreadPercent * i), priceDecimals);
      if (askPrice > 0) {
        const askMargin = this.round(levelQty * askPrice * marginRatio, 2);
        await this.client.placeLimitOrder(
          this.userId,
          this.config.market,
          'SHORT',
          levelQty,
          askPrice,
          askMargin,
        );
      }
    }
  }

  private async executeOrganicTrade(): Promise<void> {
    if (!this.isRunning) return;

    const markPrice = this.client.getLatestMarkPrice(this.config.market);
    if (!markPrice || markPrice <= 0) return;

    this.tradeCounter++;
    const { baseQty, marginRatio, qtyDecimals } = this.config;

    // Alternate buy/sell with small random variations
    const isBuy = Math.random() > 0.48;
    const kind: Shared.KIND = isBuy ? 'LONG' : 'SHORT';
    const tradeQty = Math.max(
      this.round(baseQty * (0.2 + Math.random() * 0.6), qtyDecimals),
      Math.pow(10, -qtyDecimals),
    );
    const estimatedMargin = this.round(tradeQty * markPrice * marginRatio, 2);

    await this.client.placeMarketOrder(
      this.takerUserId,
      this.config.market,
      kind,
      tradeQty,
      estimatedMargin,
    );
  }

  async checkAndReplenishBalance(targetBalance: number, minThreshold: number): Promise<void> {
    await this.client.ensureBalance(this.userId, targetBalance, minThreshold);
    await this.client.ensureBalance(this.takerUserId, targetBalance, minThreshold);
  }
}
