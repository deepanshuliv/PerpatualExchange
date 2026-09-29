'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTrading } from '../context/TradingContext';
import TradingChart from '../components/TradingChart';
import OrderBook from '../components/OrderBook';
import OrderEntryPanel from '../components/OrderEntryPanel';
import DashboardTabs from '../components/DashboardTabs';
import AuthModal from '../components/AuthModal';
import ConfirmModal from '../components/ConfirmModal';
import AccountMenu from '../components/AccountMenu';
import { useDayStats } from '../components/markets/useMarketsData';
import { MarketIcon } from '../components/ui';
import { formatFundingRate } from '../utils/funding';
import { Check, ChevronDown, LogOut } from 'lucide-react';

type MarketId = 'BTCUSD' | 'ETHUSD' | 'SOLUSD';

function isMarketId(value: string | null): value is MarketId {
  return value === 'BTCUSD' || value === 'ETHUSD' || value === 'SOLUSD';
}

const MARKETS = [
  { id: 'BTCUSD' as const, label: 'BTC-PERP', leverage: '75x', asset: 'BTC' },
  { id: 'ETHUSD' as const, label: 'ETH-PERP', leverage: '50x', asset: 'ETH' },
  { id: 'SOLUSD' as const, label: 'SOL-PERP', leverage: '20x', asset: 'SOL' },
];

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col justify-center gap-0.5">
      <span className="text-[11px] leading-none text-subtle">{label}</span>
      <span className="font-mono text-xs leading-none text-fg">{children}</span>
    </div>
  );
}

export default function TradePage() {
  const {
    market,
    setMarket,
    lastPrice,
    markPrice,
    previewFundingRate,
    fundingCountdown,
    user,
    logout,
    setAuthModalMode,
  } = useTrading();

  const [marketDropdownOpen, setMarketDropdownOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!marketDropdownOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) setMarketDropdownOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMarketDropdownOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [marketDropdownOpen]);

  // Deep links: /trade?market=ETHUSD opens that market; ?auth=login opens the login dialog.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('market');
    if (isMarketId(requested)) setMarket(requested);
    if (params.get('auth') === 'login') setAuthModalMode('login');
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectMarket = (id: MarketId) => {
    setMarket(id);
    const url = new URL(window.location.href);
    url.searchParams.set('market', id);
    url.searchParams.delete('auth');
    window.history.replaceState(null, '', url);
  };

  const current = MARKETS.find((m) => m.id === market) ?? MARKETS[0]!;

  // 24h stats come from the last day of 15m candles for this market.
  const day = useDayStats(market);
  const decimals = market === 'BTCUSD' ? 1 : 2;
  const fmtPrice = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const refPrice = lastPrice > 0 ? lastPrice : markPrice;
  const change = day && day.open24h > 0 && refPrice > 0 ? refPrice - day.open24h : null;
  const changePct = change !== null && day ? (change / day.open24h) * 100 : null;
  const changeColor = change === null ? 'text-fg' : change >= 0 ? 'text-up' : 'text-down';

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-canvas font-sans text-fg">
      <header className="z-40 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-4 select-none">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Axiom home">
          <img
            src="/logo.jpg"
            alt=""
            className="h-7 w-7 rounded-md border border-line-strong object-cover"
          />
          <span className="hidden text-[15px] font-semibold tracking-tight sm:inline">Axiom</span>
        </Link>

        <div className="mx-2 hidden h-6 w-px shrink-0 bg-line sm:block" />

        <div ref={dropdownRef} className="relative shrink-0">
          <button
            onClick={() => setMarketDropdownOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={marketDropdownOpen}
            className="flex h-9 items-center gap-2 rounded-md px-2 transition-colors hover:bg-raised"
          >
            <MarketIcon market={market} />
            <span className="text-sm font-semibold tracking-tight">{current.label}</span>
            <span className="hidden rounded-[4px] bg-raised px-1.5 py-0.5 font-mono text-[10px] text-muted sm:inline">
              {current.leverage}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-muted transition-transform ${marketDropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {marketDropdownOpen && (
            <div
              role="listbox"
              className="anim-fade-in absolute left-0 top-11 z-50 w-56 rounded-lg border border-line-strong bg-raised p-1 shadow-xl shadow-black/40"
            >
              {MARKETS.map((m) => (
                <button
                  key={m.id}
                  role="option"
                  aria-selected={market === m.id}
                  onClick={() => {
                    selectMarket(m.id);
                    setMarketDropdownOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[13px] transition-colors ${
                    market === m.id ? 'bg-hover text-fg' : 'text-muted hover:bg-hover hover:text-fg'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <MarketIcon market={m.id} size={18} />
                    <span className="font-medium">{m.label}</span>
                    <span className="font-mono text-[11px] text-subtle">{m.leverage}</span>
                  </span>
                  {market === m.id && <Check className="h-3.5 w-3.5 text-fg" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="no-scrollbar ml-2 flex min-w-0 flex-1 items-center gap-7 overflow-x-auto pr-2">
          <div className="flex shrink-0 flex-col justify-center gap-0.5">
            <span className={`font-mono text-[15px] font-medium leading-none ${changeColor}`}>
              {lastPrice > 0 ? fmtPrice(lastPrice) : '—'}
            </span>
            <span className="font-mono text-[11px] leading-none text-subtle">
              Mark{' '}
              {markPrice > 0 ? fmtPrice(markPrice) : '—'}
            </span>
          </div>

          <Stat label="24h change">
            <span className={changeColor}>
              {change === null || changePct === null
                ? '—'
                : `${change >= 0 ? '+' : '−'}${fmtPrice(Math.abs(change))} (${change >= 0 ? '+' : '−'}${Math.abs(changePct).toFixed(2)}%)`}
            </span>
          </Stat>
          <Stat label="Funding / countdown">
            <span className="inline-flex items-center gap-1.5">
              <span className="text-warn">
                {previewFundingRate !== null ? formatFundingRate(previewFundingRate) : '—'}
              </span>
              <span aria-hidden className="h-[3px] w-[3px] rounded-full bg-subtle" />
              <span>{fundingCountdown}</span>
            </span>
          </Stat>
          <Stat label="24h high">{day && day.high24h > 0 ? fmtPrice(day.high24h) : '—'}</Stat>
          <Stat label="24h low">{day && day.low24h > 0 ? fmtPrice(day.low24h) : '—'}</Stat>
          <Stat label={`24h volume (${current.asset})`}>
            {day && day.volume24h > 0
              ? day.volume24h.toLocaleString(undefined, { maximumFractionDigits: 2 })
              : '—'}
          </Stat>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {user ? (
            <AccountMenu email={user.email} onLogout={() => setLogoutConfirmOpen(true)} />
          ) : (
            <>
              <button
                onClick={() => setAuthModalMode('signup')}
                className="hidden h-8 rounded-md px-3 text-[13px] font-medium text-muted transition-colors hover:bg-raised hover:text-fg sm:block"
              >
                Sign up
              </button>
              <button
                onClick={() => setAuthModalMode('login')}
                className="h-8 rounded-md bg-fg px-3.5 text-[13px] font-medium text-canvas transition-colors hover:bg-white active:scale-[0.98]"
              >
                Log in
              </button>
            </>
          )}
        </div>
      </header>

      {/* Desktop: chart + order book share the top row, positions span beneath both,
          and the order form runs the full height on the right. */}
      <main className="flex min-h-0 w-full flex-1 flex-col gap-1.5 overflow-y-auto p-1.5 lg:grid lg:grid-cols-[minmax(0,1fr)_300px_320px] lg:grid-rows-[minmax(0,1.7fr)_minmax(0,1fr)] lg:overflow-hidden">
        <div className="min-h-[360px] w-full shrink-0 lg:col-start-1 lg:row-start-1 lg:min-h-0 lg:min-w-0">
          <TradingChart />
        </div>

        <div className="min-h-[280px] w-full shrink-0 lg:col-span-2 lg:col-start-1 lg:row-start-2 lg:min-h-0 lg:min-w-0">
          <DashboardTabs />
        </div>

        <div className="min-h-[480px] w-full shrink-0 lg:col-start-2 lg:row-start-1 lg:min-h-0 lg:min-w-0">
          <OrderBook />
        </div>

        <div className="w-full shrink-0 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:min-h-0 lg:min-w-0">
          <OrderEntryPanel />
        </div>
      </main>

      <AuthModal />

      <ConfirmModal
        open={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        onConfirm={() => {
          logout();
          setLogoutConfirmOpen(false);
        }}
        title="Log out"
        description="You'll need to log in again to place trades or manage positions."
        confirmLabel="Log out"
        variant="danger"
        icon={<LogOut className="h-5 w-5" />}
        details={user ? [{ label: 'Account', value: user.email }] : undefined}
      />
    </div>
  );
}
