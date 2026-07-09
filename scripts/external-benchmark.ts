/**
 * External exchange benchmark for comparison (Binance + Backpack).
 * Run: bun scripts/external-benchmark.ts
 */

const CONCURRENCY = Number(process.env.CONCURRENCY || 100);
const REQUESTS_PER_ENDPOINT = Number(process.env.REQUESTS || 500);

type Sample = { ms: number; ok: boolean; status: number };

type EndpointResult = {
  exchange: string;
  name: string;
  total: number;
  success: number;
  errors: number;
  rps: number;
  durationMs: number;
  min: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
};

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]!;
}

async function fetchTimed(url: string): Promise<Sample> {
  const start = performance.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    const ms = performance.now() - start;
    return { ms, ok: res.ok, status: res.status };
  } catch {
    return { ms: performance.now() - start, ok: false, status: 0 };
  }
}

async function stressEndpoint(
  exchange: string,
  name: string,
  url: string,
): Promise<EndpointResult> {
  const samples: Sample[] = [];
  let cursor = 0;
  const started = performance.now();

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= REQUESTS_PER_ENDPOINT) break;
      samples.push(await fetchTimed(url));
    }
  });

  await Promise.all(workers);
  const durationMs = performance.now() - started;
  const latencies = samples.map((s) => s.ms).sort((a, b) => a - b);
  const success = samples.filter((s) => s.ok).length;

  return {
    exchange,
    name,
    total: samples.length,
    success,
    errors: samples.length - success,
    rps: Math.round((samples.length / durationMs) * 1000),
    durationMs: Math.round(durationMs),
    min: Math.round(percentile(latencies, 0) * 100) / 100,
    avg: Math.round((latencies.reduce((a, b) => a + b, 0) / latencies.length) * 100) / 100,
    p50: Math.round(percentile(latencies, 50) * 100) / 100,
    p95: Math.round(percentile(latencies, 95) * 100) / 100,
    p99: Math.round(percentile(latencies, 99) * 100) / 100,
    max: Math.round(percentile(latencies, 100) * 100) / 100,
  };
}

const EXTERNAL_ENDPOINTS = [
  {
    exchange: 'Binance Futures',
    name: 'GET /fapi/v1/depth (BTCUSDT, limit=20)',
    url: 'https://fapi.binance.com/fapi/v1/depth?symbol=BTCUSDT&limit=20',
  },
  {
    exchange: 'Binance Futures',
    name: 'GET /fapi/v1/ticker/price (BTCUSDT)',
    url: 'https://fapi.binance.com/fapi/v1/ticker/price?symbol=BTCUSDT',
  },
  {
    exchange: 'Binance Futures',
    name: 'GET /fapi/v1/premiumIndex (mark price)',
    url: 'https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT',
  },
  {
    exchange: 'Binance Futures',
    name: 'GET /fapi/v1/klines (1h candles)',
    url: 'https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=50',
  },
  {
    exchange: 'Binance Futures',
    name: 'GET /fapi/v1/trades (recent)',
    url: 'https://fapi.binance.com/fapi/v1/trades?symbol=BTCUSDT&limit=100',
  },
  {
    exchange: 'Backpack',
    name: 'GET /api/v1/depth (BTC_USDC_PERP)',
    url: 'https://api.backpack.exchange/api/v1/depth?symbol=BTC_USDC_PERP&limit=20',
  },
  {
    exchange: 'Backpack',
    name: 'GET /api/v1/ticker (BTC_USDC_PERP)',
    url: 'https://api.backpack.exchange/api/v1/ticker?symbol=BTC_USDC_PERP',
  },
  {
    exchange: 'Backpack',
    name: 'GET /api/v1/markPrices (BTC_USDC_PERP)',
    url: 'https://api.backpack.exchange/api/v1/markPrices?symbol=BTC_USDC_PERP',
  },
  {
    exchange: 'Backpack',
    name: 'GET /api/v1/klines (1h)',
    url: `https://api.backpack.exchange/api/v1/klines?symbol=BTC_USDC_PERP&interval=1h&startTime=${Math.floor(Date.now() / 1000) - 86400 * 7}&limit=50`,
  },
  {
    exchange: 'Backpack',
    name: 'GET /api/v1/trades (recent)',
    url: 'https://api.backpack.exchange/api/v1/trades?symbol=BTC_USDC_PERP&limit=100',
  },
];

async function main() {
  console.log(`\nExternal benchmark: ${REQUESTS_PER_ENDPOINT} req × ${CONCURRENCY} concurrent\n`);

  const results: EndpointResult[] = [];
  for (const ep of EXTERNAL_ENDPOINTS) {
    process.stdout.write(`Running [${ep.exchange}] ${ep.name}...`);
    const result = await stressEndpoint(ep.exchange, ep.name, ep.url);
    results.push(result);
    console.log(` done (${result.rps} rps, p95=${result.p95}ms, success=${result.success}/${result.total})`);
    await new Promise((r) => setTimeout(r, 500));
  }

  const output = {
    generatedAt: new Date().toISOString(),
    config: { concurrency: CONCURRENCY, requestsPerEndpoint: REQUESTS_PER_ENDPOINT },
    results,
  };

  await Bun.write('scripts/external-benchmark-results.json', JSON.stringify(output, null, 2));
  console.log('\nResults written to scripts/external-benchmark-results.json\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
