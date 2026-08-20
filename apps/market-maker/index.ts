import { EngineClient } from './src/client';
import { MM_CONFIG } from './src/config';
import { MarketMakerStrategy } from './src/strategy';

async function bootstrap() {
  console.log('🤖 [Market Maker Bot] Starting service...');

  const client = new EngineClient();
  await client.init();
  console.log('✅ [Market Maker Bot] Redis connected and stream listener active');

  const strategies: MarketMakerStrategy[] = [];

  for (const [marketKey, config] of Object.entries(MM_CONFIG.markets)) {
    const strategy = new MarketMakerStrategy(config, client);
    await strategy.start(
      MM_CONFIG.initialBalance,
      MM_CONFIG.minBalanceThreshold,
      MM_CONFIG.requoteIntervalMs,
    );
    strategies.push(strategy);
    console.log(`🚀 [Market Maker Bot] Started strategy for ${marketKey}`);
  }

  // Periodic balance health check & replenishment
  setInterval(async () => {
    for (const strategy of strategies) {
      await strategy.checkAndReplenishBalance(
        MM_CONFIG.initialBalance,
        MM_CONFIG.minBalanceThreshold,
      );
    }
  }, MM_CONFIG.balanceCheckIntervalMs);

  console.log('✨ [Market Maker Bot] All market makers running successfully.');
}

bootstrap().catch((err) => {
  console.error('❌ [Market Maker Bot] Fatal startup error:', err);
  process.exit(1);
});
