'use client';

import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { EASE_OUT } from './motion';

function MockCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-gradient-to-b from-[#121212] to-surface p-1.5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">
      <div className="rounded-xl border border-line bg-canvas/60 p-5">
        <div className="mb-4 text-[13px] font-medium text-fg">{title}</div>
        {children}
      </div>
    </div>
  );
}

/** Depth ladder whose bars grow in and keep breathing. */
export function DepthMock({ mid }: { mid: number }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPhase((p) => p + 1), 1400);
    return () => clearInterval(id);
  }, []);

  const levels = [0, 1, 2, 3, 4];
  const width = (i: number, side: number) => 20 + ((i * 17 + side * 11 + phase * 7) % 60) + i * 4;
  const step = mid * 0.0008;

  return (
    <MockCard title="Order book · BTC-PERP">
      <div className="font-mono text-xs">
        {levels
          .slice()
          .reverse()
          .map((i) => (
            <div key={`a${i}`} className="relative flex justify-between px-2 py-1">
              <motion.div
                className="absolute inset-y-0 right-0 rounded-[3px] bg-down/12"
                initial={{ width: 0 }}
                animate={{ width: `${width(i, 1)}%` }}
                transition={{ duration: 0.9, ease: EASE_OUT }}
              />
              <span className="relative text-down">{(mid + step * (i + 1)).toFixed(1)}</span>
              <span className="relative text-muted">{(0.12 + i * 0.31).toFixed(3)}</span>
            </div>
          ))}
        <div className="my-2 flex items-baseline justify-between border-y border-line px-2 py-2">
          <span className="text-sm text-up">{mid.toFixed(1)}</span>
          <span className="text-[11px] text-subtle">Spread {(step * 2).toFixed(1)}</span>
        </div>
        {levels.map((i) => (
          <div key={`b${i}`} className="relative flex justify-between px-2 py-1">
            <motion.div
              className="absolute inset-y-0 right-0 rounded-[3px] bg-up/12"
              initial={{ width: 0 }}
              animate={{ width: `${width(i, 2)}%` }}
              transition={{ duration: 0.9, ease: EASE_OUT }}
            />
            <span className="relative text-up">{(mid - step * (i + 1)).toFixed(1)}</span>
            <span className="relative text-muted">{(0.2 + i * 0.27).toFixed(3)}</span>
          </div>
        ))}
      </div>
    </MockCard>
  );
}

const MAX_FUNDING = 0.0005;

/** Mirrors the engine: rate = clamp((last − mark) / mark, ±0.05%), settled every 8 hours. */
export function FundingMock({ rate, countdown }: { rate: number | null; countdown: string }) {
  const pct = rate === null ? null : rate * 100;
  // Position of the marker on a −0.05% … +0.05% track.
  const pos = rate === null ? 50 : 50 + (Math.max(-MAX_FUNDING, Math.min(MAX_FUNDING, rate)) / MAX_FUNDING) * 50;
  const direction =
    rate === null ? 'Waiting for prices' : rate > 0 ? 'Longs pay shorts' : rate < 0 ? 'Shorts pay longs' : 'No payment';

  return (
    <MockCard title="Funding · BTC-PERP">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-raised p-3">
          <div className="text-[11px] text-muted">Current estimate</div>
          <div className={`mt-1 font-mono text-lg ${rate === null ? 'text-subtle' : rate > 0 ? 'text-down' : rate < 0 ? 'text-up' : 'text-fg'}`}>
            {pct === null ? '—' : `${pct > 0 ? '+' : ''}${pct.toFixed(4)}%`}
          </div>
          <div className="text-[11px] text-subtle">{direction}</div>
        </div>
        <div className="rounded-lg bg-raised p-3">
          <div className="text-[11px] text-muted">Next settlement</div>
          <div className="mt-1 font-mono text-lg text-fg">{countdown}</div>
          <div className="text-[11px] text-subtle">Every 8 hours</div>
        </div>
      </div>

      <div className="mt-6">
        <div className="relative h-1.5 rounded-full bg-gradient-to-r from-up/50 via-raised to-down/50">
          <motion.span
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-canvas bg-fg"
            initial={{ left: '50%' }}
            animate={{ left: `${pos}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10px] text-subtle">
          <span>−0.05%</span>
          <span>0</span>
          <span>+0.05%</span>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-line px-3 py-2.5 font-mono text-[11px] leading-relaxed text-muted">
        rate = clamp((last − mark) / mark, ±0.05%)
      </div>
    </MockCard>
  );
}

/** Liquidation preview using the engine rule: close when loss reaches 95% of position margin. */
export function RiskMock({ price }: { price: number }) {
  const size = 0.25;
  const leverage = 75;
  const notional = size * price;
  const margin = notional / leverage;
  const liq = price * (1 - 0.95 / leverage);
  const f = (n: number, d = 2) => n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

  return (
    <MockCard title="Position preview · BTC-PERP long">
      <div className="flex flex-col gap-4 text-xs">
        <div>
          <div className="mb-1.5 flex justify-between">
            <span className="text-muted">Loss before liquidation</span>
            <span className="font-mono text-fg">95% of margin</span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-raised">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-warn to-down"
              initial={{ width: 0 }}
              whileInView={{ width: '95%' }}
              viewport={{ once: true }}
              transition={{ duration: 1.4, delay: 0.2, ease: EASE_OUT }}
            />
          </div>
        </div>
        <dl className="divide-y divide-line rounded-lg border border-line">
          {[
            ['Size', `${size} BTC`],
            ['Entry', f(price, 1)],
            ['Leverage', `${leverage}x`],
            ['Margin locked', `$${f(margin)}`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between px-3 py-2">
              <dt className="text-muted">{k}</dt>
              <dd className="font-mono text-fg">{v}</dd>
            </div>
          ))}
          <div className="flex justify-between bg-down/[0.06] px-3 py-2">
            <dt className="text-muted">Est. liquidation</dt>
            <dd className="font-mono text-down">{f(liq, 1)}</dd>
          </div>
        </dl>
      </div>
    </MockCard>
  );
}
