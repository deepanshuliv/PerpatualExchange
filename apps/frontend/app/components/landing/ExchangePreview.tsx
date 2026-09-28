'use client';

import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { EASE_OUT } from './motion';

/** Small deterministic PRNG so server and client render the same candles. */
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Candle {
  o: number;
  h: number;
  l: number;
  c: number;
}

function buildCandles(count: number, start: number): Candle[] {
  const rand = mulberry32(7);
  const out: Candle[] = [];
  let price = start;
  for (let i = 0; i < count; i++) {
    const drift = Math.sin(i / 7) * 60 + (i > count * 0.55 ? 45 : -10);
    const o = price;
    const c = o + drift + (rand() - 0.5) * 260;
    const h = Math.max(o, c) + rand() * 120;
    const l = Math.min(o, c) - rand() * 120;
    out.push({ o, h, l, c });
    price = c;
  }
  return out;
}

const CANDLE_COUNT = 56;
const W = 640;
const H = 300;

function Chart({ livePrice }: { livePrice: number }) {
  const base = useMemo(() => buildCandles(CANDLE_COUNT, 81200), []);
  const [tick, setTick] = useState(0);

  // The last candle keeps "trading" so the preview feels alive.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 900);
    return () => clearInterval(id);
  }, []);

  const candles = useMemo(() => {
    // Shift the illustrative series so it ends near the real price.
    const offset = livePrice > 0 ? livePrice - base[base.length - 1]!.c : 0;
    const copy = base.map((c) => ({ o: c.o + offset, h: c.h + offset, l: c.l + offset, c: c.c + offset }));
    const last = { ...copy[copy.length - 1]! };
    const wiggle = Math.sin(tick * 1.7) * 90 + Math.cos(tick * 0.6) * 50;
    last.c = last.o + 140 + wiggle;
    last.h = Math.max(last.h, last.c + 20);
    last.l = Math.min(last.l, last.o - 30);
    copy[copy.length - 1] = last;
    return copy;
  }, [base, tick, livePrice]);

  const min = Math.min(...candles.map((c) => c.l));
  const max = Math.max(...candles.map((c) => c.h));
  const y = (v: number) => 12 + ((max - v) / (max - min)) * (H - 24);
  const step = W / CANDLE_COUNT;
  const lastClose = candles[candles.length - 1]!.c;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="none" aria-hidden>
      {[0.2, 0.4, 0.6, 0.8].map((p) => (
        <line key={p} x1={0} x2={W} y1={H * p} y2={H * p} stroke="#1a1a1a" strokeWidth={1} />
      ))}
      {candles.map((c, i) => {
        const up = c.c >= c.o;
        const color = up ? 'var(--up)' : 'var(--down)';
        const x = i * step + step / 2;
        const top = y(Math.max(c.o, c.c));
        const bodyH = Math.max(1.5, Math.abs(y(c.o) - y(c.c)));
        return (
          <motion.g
            key={i}
            initial={{ opacity: 0, scaleY: 0.2 }}
            animate={{ opacity: 1, scaleY: 1 }}
            style={{ transformOrigin: `${x}px ${H / 2}px` }}
            transition={{ delay: 0.5 + i * 0.018, duration: 0.5, ease: EASE_OUT }}
          >
            <line x1={x} x2={x} y1={y(c.h)} y2={y(c.l)} stroke={color} strokeWidth={1} />
            <rect x={x - step * 0.32} y={top} width={step * 0.64} height={bodyH} fill={color} rx={0.5} />
          </motion.g>
        );
      })}
      <motion.line
        x1={0}
        x2={W}
        initial={{ y1: y(lastClose), y2: y(lastClose) }}
        animate={{ y1: y(lastClose), y2: y(lastClose) }}
        transition={{ duration: 0.4 }}
        stroke="#8f8f8f"
        strokeDasharray="3 4"
        strokeWidth={1}
      />
      <motion.g animate={{ y: y(lastClose) - 9 }} transition={{ duration: 0.4 }}>
        <rect x={W - 78} y={0} width={78} height={18} rx={3} fill="#ededed" />
        <text x={W - 39} y={12.5} textAnchor="middle" fontSize={10} fill="#0a0a0a" fontFamily="var(--font-geist-mono)">
          {(livePrice > 0 ? livePrice : lastClose).toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}
        </text>
      </motion.g>
    </svg>
  );
}

function Book({ mid }: { mid: number }) {
  const [flash, setFlash] = useState<number>(-1);
  useEffect(() => {
    const rand = mulberry32(Date.now() % 1000);
    const id = setInterval(() => setFlash(Math.floor(rand() * 16)), 650);
    return () => clearInterval(id);
  }, []);

  const rows = Array.from({ length: 8 }, (_, i) => i);
  const sizes = [0.412, 0.95, 0.188, 1.34, 0.61, 0.077, 2.05, 0.83];
  const spread = mid * 0.0008;

  return (
    <div className="flex h-full flex-col font-mono text-[10px]">
      <div className="grid grid-cols-2 px-3 pb-1.5 text-subtle">
        <span>Price</span>
        <span className="text-right">Size</span>
      </div>
      {rows
        .slice()
        .reverse()
        .map((i) => (
          <div
            key={`a${i}`}
            className={`relative grid grid-cols-2 px-3 py-[3px] transition-colors duration-500 ${flash === i ? 'bg-down/15' : ''}`}
          >
            <div className="absolute inset-y-0 right-0 bg-down/10" style={{ width: `${18 + ((i * 37) % 70)}%` }} />
            <span className="relative text-down">{(mid + spread + i * mid * 0.0008).toFixed(1)}</span>
            <span className="relative text-right text-fg/80">{sizes[i]!.toFixed(3)}</span>
          </div>
        ))}
      <div className="my-1 border-y border-line px-3 py-1.5 text-[12px] text-up">{mid.toFixed(1)}</div>
      {rows.map((i) => (
        <div
          key={`b${i}`}
          className={`relative grid grid-cols-2 px-3 py-[3px] transition-colors duration-500 ${flash === i + 8 ? 'bg-up/15' : ''}`}
        >
          <div className="absolute inset-y-0 right-0 bg-up/10" style={{ width: `${22 + ((i * 29) % 68)}%` }} />
          <span className="relative text-up">{(mid - spread - i * mid * 0.0008).toFixed(1)}</span>
          <span className="relative text-right text-fg/80">{sizes[(i + 3) % 8]!.toFixed(3)}</span>
        </div>
      ))}
    </div>
  );
}

function Ticket({ mid }: { mid: number }) {
  const liq = mid * (1 - 0.95 / 75);
  return (
    <div className="flex h-full flex-col gap-3 p-3 text-[10px]">
      <div className="grid grid-cols-2 gap-1 rounded-md bg-raised p-0.5">
        <span className="rounded-[5px] bg-up/15 py-1.5 text-center font-medium text-up">Buy / Long</span>
        <span className="py-1.5 text-center text-muted">Sell / Short</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-muted">Price</span>
        <span className="rounded-md border border-line bg-raised px-2 py-1.5 font-mono text-fg">Market</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-muted">Size</span>
        <span className="flex justify-between rounded-md border border-line bg-raised px-2 py-1.5 font-mono text-fg">
          0.250 <span className="text-subtle">BTC</span>
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-raised">
        <motion.div
          className="h-full rounded-full bg-up"
          initial={{ width: '0%' }}
          animate={{ width: ['0%', '50%', '50%', '0%'] }}
          transition={{ duration: 5, times: [0, 0.3, 0.85, 1], repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
        />
      </div>
      <div className="mt-auto flex flex-col gap-1.5 text-muted">
        <div className="flex justify-between">
          <span>Leverage</span>
          <span className="font-mono text-fg">75x</span>
        </div>
        <div className="flex justify-between">
          <span>Liq. price</span>
          <span className="font-mono text-fg">
            {liq.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </span>
        </div>
      </div>
      <motion.span
        className="rounded-md bg-up py-2 text-center font-semibold text-canvas"
        animate={{ scale: [1, 1, 0.97, 1] }}
        transition={{ duration: 5, times: [0, 0.6, 0.66, 0.72], repeat: Infinity, delay: 1.2 }}
      >
        Buy / Long BTC
      </motion.span>
    </div>
  );
}

export default function ExchangePreview({ price }: { price: number }) {
  const mid = price > 0 ? price : 82970.4;
  return (
    <div className="overflow-hidden rounded-xl border border-line-strong bg-surface shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]">
      <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#2b2b2b]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#2b2b2b]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#2b2b2b]" />
        </div>
        <span className="text-xs font-semibold tracking-tight text-fg">BTC-PERP</span>
        <span className="rounded-[4px] bg-raised px-1.5 py-0.5 font-mono text-[10px] text-muted">75x</span>
        <span className="font-mono text-xs text-up">{mid.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
        <span className="ml-auto hidden items-center gap-1.5 text-[10px] text-muted sm:flex">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-up opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-up" />
          </span>
          Live
        </span>
      </div>
      <div className="grid h-[260px] grid-cols-1 sm:h-[340px] md:grid-cols-[minmax(0,1fr)_170px_180px]">
        <div className="min-w-0 p-3">
          <Chart livePrice={price} />
        </div>
        <div className="hidden border-l border-line py-3 md:block">
          <Book mid={mid} />
        </div>
        <div className="hidden border-l border-line md:block">
          <Ticket mid={mid} />
        </div>
      </div>
    </div>
  );
}
