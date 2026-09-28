'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTrading } from '../context/TradingContext';
import { Panel, Segmented } from './ui';

const MARKET_SLIPPAGE = 0.01;
const DEFAULT_LEVERAGE = 10;
const LEVERAGE_PRESETS = [2, 5, 10, 20, 50];

export default function OrderEntryPanel() {
  const { market, balance, lastPrice, bids, asks, user, token, setAuthModalMode, placeOrder, refreshUserData } =
    useTrading();

  const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG');
  const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET'>('LIMIT');

  const [priceInput, setPriceInput] = useState('');
  const [qtyInput, setQtyInput] = useState('');
  const [sliderVal, setSliderVal] = useState(0);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const getMarketInfo = () => {
    if (market === 'ETHUSD') return { symbol: 'ETH', maxLeverage: 50 };
    if (market === 'SOLUSD') return { symbol: 'SOL', maxLeverage: 20 };
    return { symbol: 'BTC', maxLeverage: 75 };
  };

  const { symbol, maxLeverage } = getMarketInfo();
  const [leverage, setLeverage] = useState(() => Math.min(DEFAULT_LEVERAGE, maxLeverage));
  const isLong = side === 'LONG';

  // Inputs belong to one market: clear them when the market changes, then seed
  // the price from that market's first known price.
  const seededMarketRef = useRef<string | null>(null);
  // On a switch, lastPrice still holds the previous market's price for one render.
  const stalePriceRef = useRef<number | null>(null);
  const isFirstMarketRef = useRef(true);
  useEffect(() => {
    if (isFirstMarketRef.current) {
      isFirstMarketRef.current = false;
      return;
    }
    stalePriceRef.current = lastPrice;
    setPriceInput('');
    setQtyInput('');
    setSliderVal(0);
    setErrorMsg('');
    setSuccessMsg('');
    seededMarketRef.current = null;
    setLeverage(Math.min(DEFAULT_LEVERAGE, maxLeverage));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market]);

  useEffect(() => {
    if (lastPrice > 0 && lastPrice !== stalePriceRef.current && seededMarketRef.current !== market) {
      seededMarketRef.current = market;
      setPriceInput(lastPrice.toString());
    }
  }, [lastPrice, market]);

  const handleMidBBO = (type: 'MID' | 'BBO') => {
    if (lastPrice > 0) {
      if (type === 'MID') {
        setPriceInput(lastPrice.toString());
      } else {
        const spread = side === 'LONG' ? lastPrice * 0.999 : lastPrice * 1.001;
        setPriceInput(spread.toFixed(1));
      }
    }
  };

  const priceVal = parseFloat(priceInput) || 0;
  const qtyVal = parseFloat(qtyInput) || 0;
  // Market orders fill against the opposite side of the book. The engine treats
  // the submitted price as a limit, so we send the best price plus 1% slippage room.
  const bestAsk = asks.length ? Math.min(...asks.map((a) => a.price)) : 0;
  const bestBid = bids.length ? Math.max(...bids.map((b) => b.price)) : 0;
  const expectedFill = (isLong ? bestAsk : bestBid) || lastPrice;
  const effectivePrice = orderType === 'MARKET' ? expectedFill : priceVal;
  const orderValue = effectivePrice * qtyVal;
  const marginRequired = orderValue > 0 ? orderValue / leverage : 0;

  const handleLeverageChange = (next: number) => {
    setLeverage(next);
    // Leverage changes the margin for the same size; refresh the % of balance used.
    if (balance > 0 && effectivePrice > 0 && qtyVal > 0) {
      setSliderVal(Math.min(Math.round(((qtyVal * effectivePrice) / next / balance) * 100), 100));
    }
  };

  const handleSliderClick = (percent: number) => {
    setSliderVal(percent);
    if (balance > 0 && effectivePrice > 0) {
      const calculatedQty = (balance * (percent / 100) * leverage) / effectivePrice;
      setQtyInput(calculatedQty.toFixed(4));
    }
  };

  const handleQtyChange = (val: string) => {
    setQtyInput(val);
    const parsed = parseFloat(val) || 0;
    if (balance > 0 && effectivePrice > 0) {
      const margin = (parsed * effectivePrice) / leverage;
      const pct = (margin / balance) * 100;
      setSliderVal(Math.min(Math.round(pct), 100));
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!user || !token) {
      setAuthModalMode('login');
      return;
    }

    if (qtyVal <= 0) {
      setErrorMsg('Quantity must be greater than 0');
      return;
    }

    if (orderType === 'LIMIT' && priceVal <= 0) {
      setErrorMsg('Price must be greater than 0');
      return;
    }

    if (marginRequired > balance) {
      setErrorMsg('Insufficient margin for this order');
      return;
    }

    setLoading(true);
    try {
      const finalPrice =
        orderType === 'MARKET' ? expectedFill * (isLong ? 1 + MARKET_SLIPPAGE : 1 - MARKET_SLIPPAGE) : priceVal;
      const result = await placeOrder(
        qtyInput,
        finalPrice,
        orderType === 'LIMIT' ? 'LIMIT' : 'MARKET',
        side,
        marginRequired,
      );
      const filled = Number(result?.filledQty ?? NaN);
      const spent = Number(result?.totalSpent ?? NaN);
      if (orderType === 'MARKET' && filled === 0) {
        setErrorMsg('No liquidity within 1% of the best price. Nothing was filled.');
        return;
      }
      if (filled > 0 && spent > 0) {
        const avg = spent / filled;
        setSuccessMsg(
          `${isLong ? 'Bought' : 'Sold'} ${filled} ${symbol} at ${avg.toLocaleString(undefined, { maximumFractionDigits: 2 })}` +
            (filled < qtyVal ? `. ${+(qtyVal - filled).toFixed(6)} ${symbol} resting on the book.` : '.'),
        );
      } else {
        setSuccessMsg(`${isLong ? 'Buy' : 'Sell'} order for ${qtyInput} ${symbol} is on the book.`);
      }
      setQtyInput('');
      setSliderVal(0);
      refreshUserData();
    } catch (err) {
      console.log('[handleSubmitOrder] error', err);
      setErrorMsg(err instanceof Error && err.message ? err.message : 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const getEstLiquidationPrice = () => {
    if (qtyVal <= 0 || effectivePrice <= 0) return '—';
    const liqPrice =
      side === 'LONG'
        ? effectivePrice * (1 - 0.95 / leverage)
        : effectivePrice * (1 + 0.95 / leverage);
    return `$${liqPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  };

  const fmtUsd = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Panel>
      <form onSubmit={handleSubmitOrder} className="flex min-h-0 flex-1 flex-col">
        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
          <div className="grid grid-cols-2 gap-1 rounded-md bg-raised p-1">
            {(['LONG', 'SHORT'] as const).map((s) => {
              const active = side === s;
              const long = s === 'LONG';
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  aria-pressed={active}
                  className={`h-8 rounded-[5px] text-[13px] font-medium transition-colors ${
                    active
                      ? long
                        ? 'bg-up/15 text-up'
                        : 'bg-down/15 text-down'
                      : 'text-muted hover:text-fg'
                  }`}
                >
                  {long ? 'Buy / Long' : 'Sell / Short'}
                </button>
              );
            })}
          </div>

          <div>
            <Segmented
              size="md"
              options={[
                { id: 'LIMIT', label: 'Limit' },
                { id: 'MARKET', label: 'Market' },
              ]}
              value={orderType}
              onChange={setOrderType}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Leverage</span>
              <span className="font-mono text-fg">
                {leverage}x <span className="text-subtle">/ {maxLeverage}x max</span>
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={maxLeverage}
              step={1}
              value={leverage}
              onChange={(e) => handleLeverageChange(Number(e.target.value))}
              aria-label="Leverage"
              className="h-1 w-full cursor-pointer accent-[var(--fg)]"
            />
            <div className="grid grid-cols-4 gap-1">
              {LEVERAGE_PRESETS.filter((l) => l <= maxLeverage)
                .concat(maxLeverage)
                .filter((l, i, all) => all.indexOf(l) === i)
                .slice(-4)
                .map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => handleLeverageChange(l)}
                    className={`h-7 rounded-md font-mono text-[11px] transition-colors ${
                      leverage === l ? 'bg-hover text-fg' : 'bg-raised text-muted hover:bg-hover hover:text-fg'
                    }`}
                  >
                    {l}x
                  </button>
                ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Available</span>
            <span className="font-mono text-fg">${fmtUsd(balance)}</span>
          </div>

          {orderType === 'LIMIT' && (
            <label className="flex flex-col gap-1.5">
              <span className="flex items-center justify-between text-xs">
                <span className="text-muted">Price</span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleMidBBO('MID')}
                    className="text-muted transition-colors hover:text-fg"
                  >
                    Mid
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMidBBO('BBO')}
                    className="text-muted transition-colors hover:text-fg"
                  >
                    BBO
                  </button>
                </span>
              </span>
              <span className="flex h-10 items-center rounded-md border border-line bg-raised px-3 transition-colors focus-within:border-subtle hover:border-line-strong">
                <input
                  type="text"
                  inputMode="decimal"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="0.0"
                  className="w-full min-w-0 bg-transparent font-mono text-sm text-fg outline-none placeholder:text-subtle"
                />
                <span className="shrink-0 text-xs text-subtle">USD</span>
              </span>
            </label>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">Size</span>
            <span className="flex h-10 items-center rounded-md border border-line bg-raised px-3 transition-colors focus-within:border-subtle hover:border-line-strong">
              <input
                type="text"
                inputMode="decimal"
                value={qtyInput}
                onChange={(e) => handleQtyChange(e.target.value)}
                placeholder="0.0000"
                className="w-full min-w-0 bg-transparent font-mono text-sm text-fg outline-none placeholder:text-subtle"
              />
              <span className="shrink-0 text-xs text-subtle">{symbol}</span>
            </span>
          </label>

          <div className="grid grid-cols-4 gap-1">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => handleSliderClick(pct)}
                className={`h-7 rounded-md font-mono text-[11px] transition-colors ${
                  sliderVal === pct
                    ? 'bg-hover text-fg'
                    : 'bg-raised text-muted hover:bg-hover hover:text-fg'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>

          <div className="relative h-1 overflow-hidden rounded-full bg-raised" aria-hidden>
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-200 ${isLong ? 'bg-up' : 'bg-down'}`}
              style={{ width: `${sliderVal}%` }}
            />
          </div>

          <dl className="flex flex-col gap-2 border-t border-line pt-3 text-xs">
            <div className="flex justify-between">
              <dt className="text-muted">Order value</dt>
              <dd className="font-mono text-fg">{orderValue > 0 ? `$${fmtUsd(orderValue)}` : '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Margin required</dt>
              <dd className="font-mono text-fg">{marginRequired > 0 ? `$${fmtUsd(marginRequired)}` : '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Est. liquidation price</dt>
              <dd className="font-mono text-fg">
                {getEstLiquidationPrice()}
              </dd>
            </div>
          </dl>

          {errorMsg && (
            <p role="alert" className="rounded-md border border-down/20 bg-down/10 px-3 py-2 text-xs text-down">
              {errorMsg}
            </p>
          )}
          {successMsg && (
            <p role="status" className="rounded-md border border-up/20 bg-up/10 px-3 py-2 text-xs text-up">
              {successMsg}
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-line p-3">
          {user && token ? (
            <button
              type="submit"
              disabled={loading}
              className={`h-10 w-full rounded-md text-[13px] font-semibold text-canvas transition-[filter,transform] hover:brightness-110 active:scale-[0.99] disabled:opacity-50 ${
                isLong ? 'bg-up' : 'bg-down'
              }`}
            >
              {loading ? 'Placing order…' : `${isLong ? 'Buy / Long' : 'Sell / Short'} ${symbol}`}
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2.5">
              <button
                type="button"
                onClick={() => setAuthModalMode('login')}
                className="h-10 w-full rounded-md bg-fg text-[13px] font-semibold text-canvas transition-colors hover:bg-white active:scale-[0.99]"
              >
                Log in to trade
              </button>
              <p className="text-xs text-muted">
                New to Axiom?{' '}
                <button
                  type="button"
                  onClick={() => setAuthModalMode('signup')}
                  className="font-medium text-fg underline-offset-2 hover:underline"
                >
                  Create an account
                </button>
              </p>
            </div>
          )}
        </div>
      </form>
    </Panel>
  );
}
