'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { ArrowRight, Search } from 'lucide-react';
import AuthModal from '../components/AuthModal';
import { MarketIcon } from '../components/ui';
import SiteNav from '../components/landing/SiteNav';
import { EASE_OUT } from '../components/landing/motion';
import { MARKET_LIST, useMarketsData, type MarketStats } from '../components/markets/useMarketsData';

const fmt = (n: number, d: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(2);
}

function Sparkline({ points, up }: { points: number[]; up: boolean }) {
  if (points.length < 2) {
    return <div className="h-9 w-28 rounded bg-raised/60" aria-hidden />;
  }
  const w = 112;
  const h = 36;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${((i / (points.length - 1)) * w).toFixed(1)},${(h - 3 - ((p - min) / span) * (h - 6)).toFixed(1)}`)
    .join(' ');
  const color = up ? 'var(--up)' : 'var(--down)';
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${up ? 'u' : 'd'}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={`url(#spark-${up ? 'u' : 'd'})`} />
      <motion.path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: EASE_OUT }}
      />
    </svg>
  );
}

/** Price that briefly tints green or red when it ticks. */
function TickingPrice({ value, decimals }: { value: number; decimals: number }) {
  const [prev, setPrev] = useState(value);
  const [dir, setDir] = useState<'up' | 'down' | null>(null);
  if (value !== prev) {
    setDir(value > prev ? 'up' : 'down');
    setPrev(value);
  }
  return (
    <motion.span
      key={value}
      className="font-mono text-fg"
      initial={{ color: dir === 'up' ? 'var(--up)' : dir === 'down' ? 'var(--down)' : 'var(--fg)' }}
      animate={{ color: 'var(--fg)' }}
      transition={{ duration: 1.1 }}
    >
      {value > 0 ? fmt(value, decimals) : '—'}
    </motion.span>
  );
}

function Skeleton({ w = 'w-20' }: { w?: string }) {
  return <span className={`inline-block h-3.5 ${w} animate-pulse rounded bg-raised`} />;
}

function MarketRow({
  market,
  stats,
  loaded,
  index,
}: {
  market: (typeof MARKET_LIST)[number];
  stats: MarketStats;
  loaded: boolean;
  index: number;
}) {
  const price = stats.last > 0 ? stats.last : stats.mark;
  const change = stats.open24h > 0 && price > 0 ? ((price - stats.open24h) / stats.open24h) * 100 : null;
  const up = (change ?? 0) >= 0;
  const spread = stats.bestAsk > 0 && stats.bestBid > 0 ? stats.bestAsk - stats.bestBid : null;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.6, delay: 0.15 + index * 0.08, ease: EASE_OUT }}
    >
      <Link
        href={`/trade?market=${market.id}`}
        className="group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-5 transition-colors duration-200 hover:bg-surface md:grid-cols-[minmax(0,1.6fr)_1fr_0.8fr_1.3fr_1fr_128px_104px] md:px-6"
      >
        <span
          aria-hidden
          className="absolute inset-y-3 left-0 w-0.5 origin-center scale-y-0 rounded-full bg-fg transition-transform duration-300 group-hover:scale-y-100"
        />

        {/* Market */}
        <div className="flex min-w-0 items-center gap-3.5">
          <MarketIcon market={market.id} size={34} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-tight text-fg">{market.label}</span>
              <span className="rounded-[4px] bg-raised px-1.5 py-0.5 font-mono text-[10px] text-muted">
                {market.leverage}x
              </span>
            </div>
            <div className="text-xs text-muted">{market.name} perpetual</div>
          </div>
        </div>

        {/* Price (+ change on mobile) */}
        <div className="text-right md:text-left">
          <div className="text-[15px]">
            {loaded ? <TickingPrice value={price} decimals={market.decimals} /> : <Skeleton />}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-subtle">
            Mark {stats.mark > 0 ? fmt(stats.mark, market.decimals) : '—'}
          </div>
          <div className={`mt-0.5 font-mono text-xs md:hidden ${change === null ? 'text-subtle' : up ? 'text-up' : 'text-down'}`}>
            {change === null ? '—' : `${up ? '+' : ''}${change.toFixed(2)}%`}
          </div>
        </div>

        {/* 24h change */}
        <div className="hidden md:block">
          {change === null ? (
            <span className="font-mono text-sm text-subtle">—</span>
          ) : (
            <span
              className={`inline-flex rounded-md px-2 py-1 font-mono text-[13px] ${up ? 'bg-up/10 text-up' : 'bg-down/10 text-down'}`}
            >
              {up ? '+' : ''}
              {change.toFixed(2)}%
            </span>
          )}
        </div>

        {/* 24h high / low */}
        <div className="hidden font-mono text-xs md:block">
          <div className="text-fg">{stats.high24h > 0 ? fmt(stats.high24h, market.decimals) : '—'}</div>
          <div className="mt-0.5 text-subtle">{stats.low24h > 0 ? fmt(stats.low24h, market.decimals) : '—'}</div>
        </div>

        {/* Volume + spread */}
        <div className="hidden font-mono text-xs md:block">
          <div className="text-fg">
            {stats.volume24h > 0 ? `${compact(stats.volume24h)} ${market.asset}` : '—'}
          </div>
          <div className="mt-0.5 text-subtle">Spread {spread !== null ? fmt(spread, market.decimals) : '—'}</div>
        </div>

        {/* Sparkline */}
        <div className="hidden md:block">
          <Sparkline points={stats.spark} up={up} />
        </div>

        {/* CTA */}
        <div className="hidden justify-end md:flex">
          <span className="flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-4 text-[13px] font-medium text-fg transition-all duration-300 group-hover:border-fg group-hover:bg-fg group-hover:text-canvas">
            Trade
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
    </motion.li>
  );
}

export default function MarketsPage() {
  const { data, loaded } = useMarketsData();
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MARKET_LIST;
    return MARKET_LIST.filter((m) =>
      [m.label, m.name, m.asset].some((field) => field.toLowerCase().includes(q)),
    );
  }, [query]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-dvh bg-canvas font-sans text-fg">
        <SiteNav />

        <main className="relative mx-auto max-w-6xl px-5 pb-24 pt-32 sm:pt-36">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 h-[360px] w-[900px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
            style={{ background: 'radial-gradient(closest-side, rgba(240,82,79,0.10), transparent)' }}
          />

          <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <motion.h1
                className="text-[clamp(2.5rem,6vw,4rem)] font-semibold leading-none tracking-[-0.045em]"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: EASE_OUT }}
              >
                Markets
              </motion.h1>
              <motion.p
                className="mt-4 text-muted"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1, ease: EASE_OUT }}
              >
                USD-settled perpetuals. Pick one to open its exchange.
              </motion.p>
            </div>

            <motion.label
              className="flex h-11 w-full items-center gap-2.5 rounded-full border border-line-strong bg-surface px-4 transition-colors focus-within:border-subtle md:w-72"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15, ease: EASE_OUT }}
            >
              <Search className="h-4 w-4 shrink-0 text-subtle" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search markets"
                aria-label="Search markets"
                className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
              />
            </motion.label>
          </div>

          <motion.div
            className="relative mt-10 overflow-hidden rounded-2xl border border-line bg-canvas"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: EASE_OUT }}
          >
            <div className="hidden grid-cols-[minmax(0,1.6fr)_1fr_0.8fr_1.3fr_1fr_128px_104px] gap-4 border-b border-line px-6 py-3 text-xs text-subtle md:grid">
              <span>Market</span>
              <span>Last price</span>
              <span>24h change</span>
              <span>24h high / low</span>
              <span>24h volume</span>
              <span>24h</span>
              <span />
            </div>

            <ul className="divide-y divide-line">
              <AnimatePresence initial={false}>
                {visible.map((m, i) => (
                  <MarketRow key={m.id} market={m} stats={data[m.id]} loaded={loaded} index={i} />
                ))}
              </AnimatePresence>
              {visible.length === 0 && (
                <li className="px-6 py-16 text-center text-sm text-muted">No markets match “{query}”.</li>
              )}
            </ul>
          </motion.div>

          <p className="mt-5 text-xs text-subtle">
            Last price is from Axiom&apos;s order book. Mark price comes from Binance Futures.
          </p>
        </main>

        <AuthModal />
      </div>
    </MotionConfig>
  );
}
