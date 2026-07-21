'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  const logEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const selectedMarket = MARKETS.find((m) => m.value === config.market) ?? MARKETS[0];

  const appendLog = useCallback((line: string) => {
    const stamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${stamp}] ${line}`]);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    'w-full bg-[#161a1e] border border-[#2a2f36] rounded px-3 py-2 text-sm text-[#f2f4f7] outline-none focus:border-[#f59e0b]/60 transition-colors';

  const labelClass = 'block text-xs text-[#9ca3af] mb-1.5';

  return (
    <div className="min-h-screen bg-[#08090b] text-[#f2f4f7] font-sans">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight mb-2">Order Load Test</h1>
        <p className="text-sm text-[#9ca3af] mb-1">
          Runs in phases: seeds the book, crosses the spread to generate trades, opens leveraged
          positions, then injects an adverse mark price so liquidations show up in the trading UI.
        </p>
        <Link
          href="/"
          className="text-sm text-[#f59e0b] hover:text-[#fbbf24] transition-colors"
        >
          ← Back to trading UI
        </Link>

        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
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
            <p className="text-[11px] text-[#6b7280] mt-1">Mark price fetched from feed when run starts</p>
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
            className="px-5 py-2 rounded bg-[#f59e0b] text-[#08090b] text-sm font-semibold hover:bg-[#fbbf24] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {running ? 'Running…' : 'Run load test'}
          </button>
          {running && (
            <button
              type="button"
              onClick={handleStop}
              className="px-5 py-2 rounded border border-[#2a2f36] text-sm text-[#9ca3af] hover:text-[#f2f4f7] hover:border-[#4b5563] transition-colors"
            >
              Stop
            </button>
          )}
        </div>

        <div className="mt-10">
          <p className="text-[11px] uppercase tracking-wider text-[#6b7280] mb-2">Log</p>
          <div className="bg-[#0d0f12] border border-[#1e2228] rounded-lg min-h-[280px] max-h-[420px] overflow-y-auto p-4 font-mono text-xs leading-relaxed text-[#d1d5db]">
            {logs.length === 0 ? (
              <span className="text-[#4b5563]">—</span>
            ) : (
              logs.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap break-words">
                  {line}
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
