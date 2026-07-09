/**
 * Exchange endpoint stress benchmark.
 * Run: bun scripts/stress-benchmark.ts
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3001';
const CONCURRENCY = Number(process.env.CONCURRENCY || 100);
const REQUESTS_PER_ENDPOINT = Number(process.env.REQUESTS || 500);

type Sample = { ms: number; ok: boolean; status: number };

type EndpointResult = {
  name: string;
  category: string;
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

async function fetchTimed(
  url: string,
  init?: RequestInit,
): Promise<{ ms: number; ok: boolean; status: number }> {
  const start = performance.now();
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
    const ms = performance.now() - start;
    return { ms, ok: res.ok, status: res.status };
  } catch {
    return { ms: performance.now() - start, ok: false, status: 0 };
  }
}

async function stressEndpoint(
  name: string,
  category: string,
  fn: () => Promise<{ ms: number; ok: boolean; status: number }>,
): Promise<EndpointResult> {
  const samples: Sample[] = [];
  let cursor = 0;
  const started = performance.now();

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= REQUESTS_PER_ENDPOINT) break;
      samples.push(await fn());
    }
  });

  await Promise.all(workers);
  const durationMs = performance.now() - started;

  const latencies = samples.map((s) => s.ms).sort((a, b) => a - b);
  const success = samples.filter((s) => s.ok).length;

  return {
    name,
    category,
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

async function provisionToken() {
  const res = await fetch(`${API_BASE}/sim/provision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: `bench_${Date.now()}`, amount: 100_000 }),
  });
  const json = (await res.json()) as { token?: string };
  if (!json.token) throw new Error('Failed to provision sim user');
  return json.token;
}

async function main() {
  console.log(`\nStress benchmark: ${REQUESTS_PER_ENDPOINT} req × ${CONCURRENCY} concurrent per endpoint`);
  console.log(`Target: ${API_BASE}\n`);

  const token = await provisionToken();
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const endpoints: Array<{ name: string; category: string; run: () => Promise<Sample> }> = [
    {
      name: 'GET /depth/BTCUSD',
      category: 'public-market',
      run: () => fetchTimed(`${API_BASE}/depth/BTCUSD`),
    },
    {
      name: 'GET /ticker/price/BTCUSD',
      category: 'public-market',
      run: () => fetchTimed(`${API_BASE}/ticker/price/BTCUSD`),
    },
    {
      name: 'GET /ticker/mark/BTCUSD',
      category: 'public-market',
      run: () => fetchTimed(`${API_BASE}/ticker/mark/BTCUSD`),
    },
    {
      name: 'GET /trades/BTCUSD',
      category: 'public-market',
      run: () => fetchTimed(`${API_BASE}/trades/BTCUSD`),
    },
    {
      name: 'GET /liquidations/BTCUSD',
      category: 'public-market',
      run: () => fetchTimed(`${API_BASE}/liquidations/BTCUSD`),
    },
    {
      name: 'GET /candles/BTCUSD/1h',
      category: 'public-market',
      run: () => fetchTimed(`${API_BASE}/candles/BTCUSD/1h?limit=50`),
    },
    {
      name: 'POST /sim/provision',
      category: 'simulation',
      run: () =>
        fetchTimed(`${API_BASE}/sim/provision`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: `u_${Math.random()}`, amount: 10_000 }),
        }),
    },
    {
      name: 'POST /sim/inject-mark-price',
      category: 'simulation',
      run: () =>
        fetchTimed(`${API_BASE}/sim/inject-mark-price`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ market: 'BTCUSD', price: 62_000 + Math.random() * 100 }),
        }),
    },
    {
      name: 'GET /equity/available',
      category: 'auth-engine',
      run: () => fetchTimed(`${API_BASE}/equity/available`, { headers: authHeaders }),
    },
    {
      name: 'GET /positions/open/all',
      category: 'auth-engine',
      run: () => fetchTimed(`${API_BASE}/positions/open/all`, { headers: authHeaders }),
    },
    {
      name: 'GET /orders/open/all',
      category: 'auth-engine',
      run: () => fetchTimed(`${API_BASE}/orders/open/all`, { headers: authHeaders }),
    },
    {
      name: 'GET /fills',
      category: 'auth-engine',
      run: () => fetchTimed(`${API_BASE}/fills`, { headers: authHeaders }),
    },
    {
      name: 'POST /onramp',
      category: 'auth-engine-write',
      run: () =>
        fetchTimed(`${API_BASE}/onramp`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            correlationId: crypto.randomUUID(),
            type: 'add_balance',
            data: { amount: 1 },
          }),
        }),
    },
    {
      name: 'POST /order (LIMIT)',
      category: 'auth-engine-write',
      run: () =>
        fetchTimed(`${API_BASE}/order`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            correlationId: crypto.randomUUID(),
            type: 'create_order',
            data: {
              qty: '0.001',
              price: '55000',
              market: 'BTCUSD',
              type: 'LIMIT',
              kind: 'LONG',
              margin: '10',
            },
          }),
        }),
    },
  ];

  const results: EndpointResult[] = [];
  for (const ep of endpoints) {
    process.stdout.write(`Running ${ep.name}...`);
    const result = await stressEndpoint(ep.name, ep.category, ep.run);
    results.push(result);
    console.log(` done (${result.rps} rps, p95=${result.p95}ms)`);
  }

  const output = {
    generatedAt: new Date().toISOString(),
    config: { concurrency: CONCURRENCY, requestsPerEndpoint: REQUESTS_PER_ENDPOINT, apiBase: API_BASE },
    results,
  };

  await Bun.write('scripts/stress-benchmark-results.json', JSON.stringify(output, null, 2));
  console.log('\nResults written to scripts/stress-benchmark-results.json\n');
  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
