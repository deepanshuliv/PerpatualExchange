'use client';

import { motion } from 'motion/react';
import { EASE_OUT, Eyebrow, Reveal, SplitHeadline } from './motion';

const FLOW = ['Browser', 'Express API', 'Redis Streams', 'Matching engine', 'Redis Streams', 'WebSocket · DB'];

const SERVICES = [
  {
    name: 'Matching engine',
    path: 'apps/engine',
    body: 'In-memory order books with price-time matching, liquidations, funding and ADL. Snapshots state every 3s.',
  },
  {
    name: 'API',
    path: 'apps/backend',
    body: 'Express, JWT and Zod. Forwards each request to the engine over Redis Streams.',
  },
  {
    name: 'WebSocket server',
    path: 'apps/ws',
    body: 'Pushes depth, trades, prices, funding, liquidations and candles to subscribers.',
  },
  {
    name: 'Persistence',
    path: 'apps/db',
    body: 'Writes orders, fills, ticks and candles to Postgres with TimescaleDB.',
  },
  {
    name: 'Market maker',
    path: 'apps/market-maker',
    body: 'Quotes 5 levels per side on every market and requotes each second.',
  },
  {
    name: 'Price feed',
    path: 'Binance listener',
    body: 'Binance Futures mark price every second. Liquidations and funding use it.',
  },
];

const STACK = [
  'TypeScript',
  'Bun',
  'Next.js',
  'Express',
  'Redis Streams',
  'PostgreSQL',
  'TimescaleDB',
  'Prisma',
  'WebSockets',
  'Docker Compose',
  'Caddy',
];

export default function Architecture() {
  return (
    <section id="architecture" className="scroll-mt-20 border-t border-line/70 py-28">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mb-14 flex flex-col items-center text-center">
          <Reveal>
            <Eyebrow>Under the hood</Eyebrow>
          </Reveal>
          <SplitHeadline
            text="Six services. / *One event stream.*"
            className="mt-4 text-balance text-[clamp(2.2rem,5vw,3.75rem)] font-semibold leading-[1.02] tracking-[-0.04em]"
          />
          <Reveal delay={0.15}>
            <p className="mt-5 max-w-lg text-balance text-muted">
Services talk over Redis Streams. This is the path an order takes.
            </p>
          </Reveal>
        </div>

        <Reveal>
          <div className="relative mb-12 overflow-hidden rounded-2xl border border-line bg-surface px-4 py-6 sm:px-8">
            <div className="relative flex items-center justify-between gap-2">
              <div aria-hidden className="absolute inset-x-6 top-1/2 h-px -translate-y-1/2 bg-line-strong" />
              <motion.span
                aria-hidden
                className="absolute top-1/2 h-1.5 w-12 -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-up to-transparent"
                initial={{ left: '0%' }}
                animate={{ left: ['0%', '94%'] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.4 }}
              />
              {FLOW.map((step, i) => (
                <span
                  key={`${step}-${i}`}
                  className={`relative z-10 rounded-full border px-2.5 py-1.5 text-center text-[10px] sm:px-3.5 sm:text-xs ${
                    step === 'Matching engine'
                      ? 'border-fg/30 bg-fg text-canvas'
                      : 'border-line-strong bg-canvas text-muted'
                  } ${i === 2 || i === 4 ? 'hidden sm:inline' : ''}`}
                >
                  {step}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s, i) => (
            <motion.div
              key={s.name}
              className="group bg-canvas p-6 transition-colors duration-300 hover:bg-surface"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7, delay: i * 0.07, ease: EASE_OUT }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-semibold tracking-tight text-fg">{s.name}</h3>
                <span className="truncate font-mono text-[10px] text-subtle">{s.path}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">{s.body}</p>
            </motion.div>
          ))}
        </div>

        <Reveal delay={0.1}>
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {STACK.map((t) => (
              <span
                key={t}
                className="rounded-full border border-line-strong px-3 py-1 font-mono text-[11px] text-muted"
              >
                {t}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
