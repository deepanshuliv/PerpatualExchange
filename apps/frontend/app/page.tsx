'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { MotionConfig, motion, useScroll, useTransform } from 'motion/react';
import { ArrowRight, Check } from 'lucide-react';
import { useTrading } from './context/TradingContext';
import AuthModal from './components/AuthModal';
import { MarketIcon } from './components/ui';
import Architecture from './components/landing/Architecture';
import ExchangePreview from './components/landing/ExchangePreview';
import { DepthMock, FundingMock, RiskMock } from './components/landing/FeatureMocks';
import SiteNav from './components/landing/SiteNav';
import { CountUp, EASE_OUT, Eyebrow, Reveal, SplitHeadline } from './components/landing/motion';
import { useMarketPrices, type LandingMarket } from './components/landing/useMarketPrices';

const FALLBACK_BTC = 82970.4;

const fmt = (n: number, d = 1) =>
  n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

/* ----------------------------------------------------------------- hero */

function Hero({ btc }: { btc: number }) {
  const previewRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: previewRef, offset: ['start end', 'start 0.25'] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [22, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.9, 1]);
  const glow = useTransform(scrollYProgress, [0, 1], [0.25, 0.7]);

  return (
    <section className="relative overflow-hidden pt-36 sm:pt-44">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[620px] w-[1100px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(closest-side, rgba(240,82,79,0.16), transparent)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(#161616 1px, transparent 1px), linear-gradient(90deg, #161616 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 70% 55% at 50% 0%, #000 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 55% at 50% 0%, #000 40%, transparent 100%)',
        }}
      />

      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-5 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_OUT }}
        >
          <Link
            href="/markets"
            className="group mb-8 inline-flex items-center gap-2.5 rounded-full border border-line-strong bg-surface/80 py-1.5 pl-2 pr-3.5 text-xs text-muted backdrop-blur transition-colors hover:border-[#3a3a3a] hover:text-fg"
          >
            <span className="flex items-center gap-1.5 rounded-full bg-up/10 px-2 py-0.5 text-up">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-up opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-up" />
              </span>
              Live
            </span>
            <span>
              BTC-PERP <span className="font-mono text-fg">{btc > 0 ? `$${fmt(btc)}` : '—'}</span>
            </span>
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </motion.div>

        <SplitHeadline
          as="h1"
          text="Perpetual futures, / *from the engine up.*"
          className="text-balance text-[clamp(2.7rem,7.5vw,6rem)] font-semibold leading-[0.97] tracking-[-0.045em]"
        />

        <motion.p
          className="mt-7 max-w-xl text-balance text-[17px] leading-relaxed text-muted"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35, ease: EASE_OUT }}
        >
          Trade BTC, ETH and SOL perpetuals on a matching engine built from scratch. Watch without an
          account, log in to trade with test funds.
        </motion.p>

        <motion.div
          className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: EASE_OUT }}
        >
          <Link
            href="/markets"
            className="group flex h-12 items-center gap-2 rounded-full bg-fg px-7 text-sm font-semibold text-canvas shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_10px_40px_-10px_rgba(255,255,255,0.35)] transition-[background-color,transform] hover:bg-white active:scale-[0.97]"
          >
            View markets
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#architecture"
            className="flex h-12 items-center rounded-full border border-line-strong px-7 text-sm font-medium text-fg transition-colors hover:border-[#3a3a3a] hover:bg-surface"
          >
            How it&apos;s built
          </a>
        </motion.div>
      </div>

      <div ref={previewRef} className="relative mx-auto mt-20 max-w-6xl px-5 [perspective:1600px]">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-x-10 -top-10 bottom-10 rounded-[40px] blur-3xl"
          style={{ opacity: glow, background: 'radial-gradient(closest-side, rgba(46,189,133,0.12), transparent)' }}
        />
        <motion.div
          style={{ rotateX, scale, transformOrigin: '50% 0%' }}
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.55, ease: EASE_OUT }}
        >
          <ExchangePreview price={btc} />
        </motion.div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-canvas to-transparent"
        />
      </div>

      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-y-10 px-5 py-20 md:grid-cols-4">
        {[
          { value: <CountUp to={3} />, label: 'Perpetual markets' },
          { value: <CountUp to={75} suffix="x" />, label: 'Max leverage' },
          { value: <CountUp to={8} suffix="h" />, label: 'Funding interval' },
          { value: <CountUp to={1} suffix="s" />, label: 'Mark-price updates' },
        ].map((s, i) => (
          <Reveal key={s.label} delay={i * 0.08} className="flex flex-col items-center gap-1.5">
            <span className="font-mono text-3xl font-medium tracking-tight text-fg sm:text-4xl">{s.value}</span>
            <span className="text-[13px] text-muted">{s.label}</span>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------------------------------- ticket demo */

// Mirrors the order form: leverage from 1x up to each market's max.
const DEMO_MARKETS: { id: LandingMarket; label: string; asset: string; leverage: number; size: number; fallback: number; decimals: number }[] = [
  { id: 'BTCUSD', label: 'BTC-PERP', asset: 'BTC', leverage: 75, size: 0.25, fallback: FALLBACK_BTC, decimals: 1 },
  { id: 'ETHUSD', label: 'ETH-PERP', asset: 'ETH', leverage: 50, size: 2, fallback: 3120.5, decimals: 2 },
  { id: 'SOLUSD', label: 'SOL-PERP', asset: 'SOL', leverage: 20, size: 40, fallback: 182.4, decimals: 2 },
];

function TicketDemo({ prices }: { prices: Record<LandingMarket, number> }) {
  const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG');
  const [marketId, setMarketId] = useState<LandingMarket>('BTCUSD');
  const [leverage, setLeverage] = useState(10);
  const m = DEMO_MARKETS.find((d) => d.id === marketId)!;
  const lev = Math.min(leverage, m.leverage);
  const leverageOptions = [5, 10, 20, m.leverage].filter((l, i, all) => l <= m.leverage && all.indexOf(l) === i);
  const price = prices[m.id] > 0 ? prices[m.id] : m.fallback;
  const long = side === 'LONG';
  const notional = m.size * price;
  const margin = notional / lev;
  const liq = long ? price * (1 - 0.95 / lev) : price * (1 + 0.95 / lev);

  return (
    <section className="relative border-t border-line/70 py-28">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mb-14 flex flex-col items-center text-center">
          <SplitHeadline
            text="Go long. Go short. / *See the risk first.*"
            className="text-balance text-[clamp(2.2rem,5vw,3.75rem)] font-semibold leading-[1.02] tracking-[-0.04em]"
          />
          <Reveal delay={0.15}>
            <p className="mt-5 max-w-md text-balance text-muted">
              Margin and liquidation price are shown before you submit. Try it.
            </p>
          </Reveal>
        </div>

        <Reveal>
          <div className="mx-auto max-w-3xl rounded-3xl border border-line bg-gradient-to-b from-[#121212] to-surface p-2">
            <div className="grid gap-6 rounded-[20px] border border-line bg-canvas/70 p-6 md:grid-cols-2 md:p-8">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-1">
                  {DEMO_MARKETS.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setMarketId(d.id)}
                      aria-pressed={marketId === d.id}
                      className={`flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors ${
                        marketId === d.id ? 'bg-hover text-fg' : 'bg-raised text-muted hover:text-fg'
                      }`}
                    >
                      <MarketIcon market={d.id} size={14} />
                      {d.asset}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-1 rounded-lg bg-raised p-1">
                  {(['LONG', 'SHORT'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSide(s)}
                      aria-pressed={side === s}
                      className="relative h-9 rounded-md text-[13px] font-medium"
                    >
                      {side === s && (
                        <motion.span
                          layoutId="ticket-side"
                          className={`absolute inset-0 rounded-md ${s === 'LONG' ? 'bg-up/15' : 'bg-down/15'}`}
                          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        />
                      )}
                      <span className={`relative ${side === s ? (s === 'LONG' ? 'text-up' : 'text-down') : 'text-muted'}`}>
                        {s === 'LONG' ? 'Buy / Long' : 'Sell / Short'}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-1.5 text-xs">
                  <span className="flex justify-between text-muted">
                    Leverage <span className="font-mono text-subtle">max {m.leverage}x</span>
                  </span>
                  <div className="grid grid-cols-4 gap-1">
                    {leverageOptions.map((l) => (
                      <button
                        key={l}
                        onClick={() => setLeverage(l)}
                        aria-pressed={lev === l}
                        className={`h-8 rounded-md font-mono text-[11px] transition-colors ${
                          lev === l ? 'bg-hover text-fg' : 'bg-raised text-muted hover:text-fg'
                        }`}
                      >
                        {l}x
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 text-xs">
                  <span className="text-muted">Size</span>
                  <span className="flex h-10 items-center justify-between rounded-md border border-line bg-raised px-3 font-mono text-sm text-fg">
                    {m.size} <span className="text-xs text-subtle">{m.asset}</span>
                  </span>
                </div>
              </div>

              <div className="flex flex-col justify-between gap-6">
                <dl className="flex flex-col gap-3 text-sm">
                  {[
                    ['Price', fmt(price, m.decimals)],
                    ['Leverage', `${lev}x`],
                    ['Margin', `$${fmt(margin, 2)}`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-line pb-3">
                      <dt className="text-muted">{k}</dt>
                      <dd className="font-mono text-fg">{v}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between">
                    <dt className="text-muted">Est. liquidation</dt>
                    <dd>
                      <motion.span
                        key={`${side}-${marketId}-${lev}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`inline-block font-mono ${long ? 'text-down' : 'text-up'}`}
                      >
                        {fmt(liq, m.decimals)}
                      </motion.span>
                    </dd>
                  </div>
                </dl>
                <Link
                  href={`/trade?market=${m.id}`}
                  className={`group flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-canvas transition-[filter,transform] hover:brightness-110 active:scale-[0.98] ${
                    long ? 'bg-up' : 'bg-down'
                  }`}
                >
                  Open {m.label}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ features */

function FeatureRow({
  eyebrow,
  title,
  body,
  points,
  mock,
  flip,
}: {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  mock: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-12 md:grid-cols-2 md:gap-20">
      <Reveal className={flip ? 'md:order-2' : ''}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h3 className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-[-0.03em] text-fg sm:text-[2.5rem]">
          {title}
        </h3>
        <p className="mt-4 max-w-md text-pretty leading-relaxed text-muted">{body}</p>
        <ul className="mt-7 flex flex-col gap-3">
          {points.map((p, i) => (
            <motion.li
              key={p}
              className="flex items-start gap-3 text-[15px] text-fg/90"
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + i * 0.08, duration: 0.6, ease: EASE_OUT }}
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-up/12 text-up">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              {p}
            </motion.li>
          ))}
        </ul>
      </Reveal>
      <Reveal delay={0.1} y={40} className={flip ? 'md:order-1' : ''}>
        {mock}
      </Reveal>
    </div>
  );
}

function Features({ btc }: { btc: number }) {
  const { fundingCountdown, previewFundingRate, market } = useTrading();
  const price = btc > 0 ? btc : FALLBACK_BTC;
  return (
    <section id="features" className="scroll-mt-20 border-t border-line/70 bg-[#0c0c0c] py-28">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mb-20 flex flex-col items-center text-center">
          <SplitHeadline
            text="Built like a *real exchange.*"
            className="text-balance text-[clamp(2.2rem,5vw,3.75rem)] font-semibold leading-[1.02] tracking-[-0.04em]"
          />
        </div>

        <div className="flex flex-col gap-28">
          <FeatureRow
            eyebrow="Matching engine"
            title="Price-time priority, in memory."
            body="Orders match against a live book. Cancels and partial fills release unused margin."
            points={['Limit and market orders, long or short', 'Depth, trades and candles over WebSocket']}
            mock={<DepthMock mid={price} />}
          />
          <FeatureRow
            flip
            eyebrow="Funding"
            title="Funding you can read."
            body="Settled every 8 hours and capped at ±0.05%. Positive rates mean longs pay shorts."
            points={['Live rate estimate and countdown', 'Paid from and to position margin']}
            mock={<FundingMock rate={market === 'BTCUSD' ? previewFundingRate : null} countdown={fundingCountdown} />}
          />
          <FeatureRow
            eyebrow="Liquidations"
            title="Know your liquidation price first."
            body="A position closes when its loss reaches 95% of margin. Anything the book can't fill is auto-deleveraged."
            points={['Checked on every mark-price update', 'ADL starts with the most profitable opposite position']}
            mock={<RiskMock price={price} />}
          />
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- how it works */

const STEPS = [
  { title: 'Pick a market', body: 'BTC, ETH or SOL. No account needed to watch.' },
  { title: 'Log in', body: 'New accounts start with $10,000 in test funds.' },
  { title: 'Place an order', body: 'Limit or market, with margin and liquidation shown first.' },
  { title: 'Manage it', body: 'Positions, PnL and open orders update live.' },
];

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 border-t border-line/70 py-28">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mb-16 flex flex-col items-center text-center">
          <SplitHeadline
            text="From first look / to *first trade.*"
            className="text-balance text-[clamp(2.2rem,5vw,3.75rem)] font-semibold leading-[1.02] tracking-[-0.04em]"
          />
        </div>

        <div className="relative grid gap-10 md:grid-cols-4 md:gap-6">
          <motion.div
            aria-hidden
            className="absolute left-0 right-0 top-5 hidden h-px origin-left bg-gradient-to-r from-line-strong via-[#3a3a3a] to-line-strong md:block"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 1.4, ease: EASE_OUT }}
          />
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={0.15 + i * 0.12} className="relative">
              <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-line-strong bg-canvas font-mono text-sm text-fg">
                {i + 1}
              </span>
              <h3 className="mt-6 text-lg font-semibold tracking-tight text-fg">{s.title}</h3>
              <p className="mt-2 text-pretty text-sm leading-relaxed text-muted">{s.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- final CTA */

function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-line/70 py-36">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-3xl"
        style={{ background: 'radial-gradient(closest-side, rgba(240,82,79,0.12), transparent)' }}
      />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-5 text-center">
        <SplitHeadline
          text="Your next trade / starts *here.*"
          className="text-balance text-[clamp(2.6rem,6.5vw,5rem)] font-semibold leading-[0.98] tracking-[-0.045em]"
        />
        <Reveal delay={0.2}>
          <Link
            href="/markets"
            className="group mt-10 flex h-12 items-center gap-2 rounded-full bg-fg px-7 text-sm font-semibold text-canvas transition-[background-color,transform] hover:bg-white active:scale-[0.97]"
          >
            View markets
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.jpg" alt="" className="h-7 w-7 rounded-md border border-line-strong object-cover" />
            <span className="text-[15px] font-semibold tracking-tight">Axiom</span>
          </Link>
          <p className="mt-4 text-xs leading-relaxed text-subtle">
            A personal project, not a licensed exchange. Balances are test funds. Don&apos;t reuse a real password.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-16 gap-y-3 text-[13px]">
          <span className="text-subtle">Markets</span>
          <span className="text-subtle">Product</span>
          <Link href="/trade?market=BTCUSD" className="text-muted transition-colors hover:text-fg">BTC-PERP</Link>
          <a href="#features" className="text-muted transition-colors hover:text-fg">Features</a>
          <Link href="/trade?market=ETHUSD" className="text-muted transition-colors hover:text-fg">ETH-PERP</Link>
          <a href="#architecture" className="text-muted transition-colors hover:text-fg">Architecture</a>
          <Link href="/trade?market=SOLUSD" className="text-muted transition-colors hover:text-fg">SOL-PERP</Link>
          <Link href="/markets" className="text-muted transition-colors hover:text-fg">All markets</Link>
        </div>
      </div>
      <div className="mx-auto max-w-6xl border-t border-line/70 px-5 py-6 text-xs text-subtle">
        © {new Date().getFullYear()} Axiom
      </div>
    </footer>
  );
}

/* ---------------------------------------------------------------- page */

export default function LandingPage() {
  const router = useRouter();
  const prices = useMarketPrices();

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-dvh bg-canvas font-sans text-fg selection:bg-[#2b2b2b]">
        <SiteNav />
        <main>
          <Hero btc={prices.BTCUSD} />
          <TicketDemo prices={prices} />
          <Features btc={prices.BTCUSD} />
          <Architecture />
          <HowItWorks />
          <FinalCta />
        </main>
        <Footer />
        <AuthModal onAuthenticated={() => router.push('/markets')} />
      </div>
    </MotionConfig>
  );
}
