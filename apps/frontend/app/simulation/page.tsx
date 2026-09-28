'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { runLoadTest, type LoadTestConfig, type SimMarket } from './runLoadTest';

const MARKETS: { value: SimMarket; label: string; symbol: string }[] = [
  { value: 'BTCUSD', label: 'BTC-PERP', symbol: 'BTC' },
  { value: 'ETHUSD', label: 'ETH-PERP', symbol: 'ETH' },
  { value: 'SOLUSD', label: 'SOL-PERP', symbol: 'SOL' },
];

const DEFAULT_CONFIG: LoadTestConfig = {
  users: 6,
  ordersPerUser: 12,
  market: 'BTCUSD',
  qtyMin: 0.002,
  qtyMax: 0.015,
  delayMinSec: 0.3,
  delayMaxSec: 2,
};

export default function SimulationPage() {
  const [config, setConfig] = useState<LoadTestConfig>(DEFAULT_CONFIG);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const logBoxRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const selectedMarket = MARKETS.find((m) => m.value === config.market) ?? MARKETS[0];

  const appendLog = useCallback((line: string) => {
    const stamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${stamp}] ${line}`]);
  }, []);

  // Keep the newest line visible by scrolling the log box itself, never the page.
  useEffect(() => {
    const box = logBoxRef.current;
    if (box && logs.length > 0) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  }, [logs]);

  const updateConfig = <K extends keyof LoadTestConfig>(key: K, value: LoadTestConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleRun = async () => {
    if (running) return;

    if (config.qtyMin <= 0 || config.qtyMax <= 0 || config.qtyMin > config.qtyMax) {
      appendLog('Invalid quantity range — min must be > 0 and ≤ max.');
      return;
    }

    if (config.delayMinSec < 0 || config.delayMaxSec < 0 || config.delayMinSec > config.delayMaxSec) {
      appendLog('Invalid delay range — min must be ≥ 0 and ≤ max.');
      return;
    }

    if (config.users < 1 || config.ordersPerUser < 1) {
      appendLog('Users and orders per user must be at least 1.');
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    appendLog('--- Load test started ---');

    try {
      await runLoadTest(config, appendLog, controller.signal);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        appendLog('Load test stopped.');
      } else {
        console.log('[handleRun] error', err);
        appendLog(`Error: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const inputClass =
    'h-10 w-full rounded-md border border-line bg-raised px-3 font-mono text-sm text-fg outline-none transition-colors hover:border-line-strong focus:border-subtle disabled:opacity-50';

  const labelClass = 'mb-1.5 block text-xs text-muted';

  return (
    <div className="min-h-dvh bg-canvas font-sans text-fg">
      <div className="mx-auto max-w-3xl px-5 py-12">
        <Link href="/trade" className="text-[13px] text-muted transition-colors hover:text-fg">
          ← Back to exchange
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em]">Order load test</h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">
          Runs in phases: seeds the book, crosses the spread to generate trades, opens leveraged
          positions, then injects an adverse mark price so liquidations show up in the trading UI.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 rounded-xl border border-line bg-surface p-6 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Users</label>
            <input
              type="number"
              min={1}
              max={50}
              value={config.users}
              disabled={running}
              onChange={(e) => updateConfig('users', Math.max(1, parseInt(e.target.value, 10) || 1))}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Orders per user</label>
            <input
              type="number"
              min={1}
              max={500}
              value={config.ordersPerUser}
              disabled={running}
              onChange={(e) =>
                updateConfig('ordersPerUser', Math.max(1, parseInt(e.target.value, 10) || 1))
              }
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Market</label>
            <select
              value={config.market}
              disabled={running}
              onChange={(e) => updateConfig('market', e.target.value as SimMarket)}
              className={inputClass}
            >
              {MARKETS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-subtle">Mark price fetched from feed when run starts</p>
          </div>

          <div>
            <label className={labelClass}>Qty min ({selectedMarket.symbol})</label>
            <input
              type="number"
              min={0}
              step="any"
              value={config.qtyMin}
              disabled={running}
              onChange={(e) => updateConfig('qtyMin', parseFloat(e.target.value) || 0)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Qty max ({selectedMarket.symbol})</label>
            <input
              type="number"
              min={0}
              step="any"
              value={config.qtyMax}
              disabled={running}
              onChange={(e) => updateConfig('qtyMax', parseFloat(e.target.value) || 0)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Delay min (sec)</label>
            <input
              type="number"
              min={0}
              step="any"
              value={config.delayMinSec}
              disabled={running}
              onChange={(e) => updateConfig('delayMinSec', parseFloat(e.target.value) || 0)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Delay max (sec)</label>
            <input
              type="number"
              min={0}
              step="any"
              value={config.delayMaxSec}
              disabled={running}
              onChange={(e) => updateConfig('delayMaxSec', parseFloat(e.target.value) || 0)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="mt-8 flex items-center gap-3">
          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            className="h-10 rounded-md bg-fg px-5 text-[13px] font-semibold text-canvas transition-[background-color,transform] hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? 'Running…' : 'Run load test'}
          </button>
          {running && (
            <button
              type="button"
              onClick={handleStop}
              className="h-10 rounded-md border border-line-strong px-5 text-[13px] font-medium text-muted transition-colors hover:bg-raised hover:text-fg"
            >
              Stop
            </button>
          )}
        </div>

        <div className="mt-10">
          <p className="mb-2 text-xs text-subtle">Log</p>
          <div ref={logBoxRef} className="custom-scrollbar max-h-[420px] min-h-[280px] overflow-y-auto rounded-xl border border-line bg-surface p-4 font-mono text-xs leading-relaxed text-fg/85">
            {logs.length === 0 ? (
              <span className="text-subtle">No runs yet.</span>
            ) : (
              logs.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap break-words">
                  {line}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
