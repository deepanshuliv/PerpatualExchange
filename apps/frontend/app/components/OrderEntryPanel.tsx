'use client';

import React, { useEffect, useState } from 'react';
import { useTrading } from '../context/TradingContext';

const BP = {
  bg: '#0B0E11',
  border: '#2B2F36',
  inputBg: '#161A1E',
  muted: '#848E9C',
  green: '#14F195',
  red: '#F23645',
  errorBg: 'rgba(255, 77, 79, 0.1)',
  errorBorder: '#3A1C1C',
} as const;

export default function OrderEntryPanel() {
  const { market, balance, lastPrice, user, token, setAuthModalMode, placeOrder, refreshUserData } =
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
    if (market === 'ETHUSD') {
      return { symbol: 'ETH', leverage: 50, badgeBg: 'bg-[#627eea]' };
    }
    if (market === 'SOLUSD') {
      return { symbol: 'SOL', leverage: 20, badgeBg: 'bg-[#14F195]' };
    }
    return { symbol: 'BTC', leverage: 75, badgeBg: 'bg-[#f7931a]' };
  };

  const { symbol, leverage, badgeBg } = getMarketInfo();
  const accentColor = side === 'LONG' ? BP.green : BP.red;

  useEffect(() => {
    if (lastPrice > 0 && !priceInput) {
      setPriceInput(lastPrice.toString());
    }
  }, [lastPrice]);

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
  const effectivePrice = orderType === 'MARKET' ? lastPrice || priceVal : priceVal;
  const orderValue = effectivePrice * qtyVal;
  const marginRequired = orderValue > 0 ? orderValue / leverage : 0;

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
      const finalPrice = orderType === 'MARKET' ? lastPrice || priceVal : priceVal;
      await placeOrder(
        qtyInput,
        finalPrice,
        orderType === 'LIMIT' ? 'LIMIT' : 'MARKET',
        side,
        marginRequired,
      );
      setSuccessMsg(`Successfully placed ${side} order for ${qtyInput} ${symbol}`);
      setQtyInput('');
      setSliderVal(0);
      refreshUserData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const getEstLiquidationPrice = () => {
    if (qtyVal <= 0 || effectivePrice <= 0) return '--';
    const liqPrice =
      side === 'LONG'
        ? effectivePrice * (1 - 0.95 / leverage)
        : effectivePrice * (1 + 0.95 / leverage);
    return `$${liqPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  };

  return (
    <div
      className="flex flex-col h-full rounded-xl p-4 text-white select-none font-sans justify-between min-h-[500px]"
      style={{ backgroundColor: BP.bg, border: `1px solid ${BP.border}` }}
    >
      <form onSubmit={handleSubmitOrder} className="flex flex-col gap-4">
        {/* Buy / Sell toggle */}
        <div
          className="grid grid-cols-2 rounded-lg p-1 h-11 shrink-0"
          style={{ backgroundColor: BP.inputBg }}
        >
          <button
            type="button"
            onClick={() => setSide('LONG')}
            className="rounded-md font-semibold text-xs transition-all"
            style={
              side === 'LONG'
                ? { color: BP.green, border: `1px solid ${BP.green}`, background: 'transparent' }
                : { color: BP.muted, border: '1px solid transparent', background: 'transparent' }
            }
          >
            Buy / Long
          </button>
          <button
            type="button"
            onClick={() => setSide('SHORT')}
            className="rounded-md font-semibold text-xs transition-all"
            style={
              side === 'SHORT'
                ? { color: BP.red, border: `1px solid ${BP.red}`, background: 'transparent' }
                : { color: BP.muted, border: '1px solid transparent', background: 'transparent' }
            }
          >
            Sell / Short
          </button>
        </div>

        {/* Order type tabs */}
        <div className="flex items-center gap-5 text-sm">
          {(['LIMIT', 'MARKET'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setOrderType(type)}
              className="font-semibold transition-colors pb-1"
              style={
                orderType === type
                  ? { color: '#FFFFFF', borderBottom: '2px solid #FFFFFF' }
                  : { color: BP.muted, borderBottom: '2px solid transparent' }
              }
            >
              {type === 'LIMIT' ? 'Limit' : 'Market'}
            </button>
          ))}
        </div>

        {/* Available equity */}
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: BP.muted }}>Available Equity</span>
          <span className="font-mono font-semibold text-white">
            $
            {balance.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>

        {/* Price input (limit only) */}
        {orderType === 'LIMIT' && (
          <div
            className="rounded-lg p-4 flex flex-col gap-2"
            style={{ backgroundColor: BP.inputBg }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: BP.muted }}>
                Price
              </span>
              <div className="flex gap-2 text-[10px]">
                <button
                  type="button"
                  onClick={() => handleMidBBO('MID')}
                  className="font-semibold hover:underline"
                  style={{ color: BP.green }}
                >
                  Mid
                </button>
                <span style={{ color: BP.border }}>|</span>
                <button
                  type="button"
                  onClick={() => handleMidBBO('BBO')}
                  className="font-semibold hover:underline"
                  style={{ color: BP.green }}
                >
                  BBO
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <input
                type="text"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder="0"
                className="w-full bg-transparent text-xl font-bold text-white outline-none font-mono"
              />
              <div
                className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ backgroundColor: BP.border }}
              >
                $
              </div>
            </div>
          </div>
        )}

        {/* Quantity input */}
        <div
          className="rounded-lg p-4 flex flex-col gap-2"
          style={{ backgroundColor: BP.inputBg }}
        >
          <span className="text-xs" style={{ color: BP.muted }}>
            Quantity
          </span>
          <div className="flex items-center justify-between gap-3">
            <input
              type="text"
              value={qtyInput}
              onChange={(e) => handleQtyChange(e.target.value)}
              placeholder="0"
              className="w-full bg-transparent text-xl font-bold text-white outline-none font-mono"
            />
            <div
              className={`px-2 py-1 rounded text-[11px] text-black font-bold shrink-0 ${badgeBg}`}
            >
              {symbol}
            </div>
          </div>
        </div>

        {/* Percentage slider */}
        <div className="flex flex-col gap-2 py-1">
          <div className="relative w-full h-1 rounded" style={{ backgroundColor: BP.border }}>
            <div
              className="absolute top-0 left-0 h-full rounded transition-all duration-150"
              style={{ width: `${sliderVal}%`, backgroundColor: accentColor }}
            />
            {[0, 25, 50, 75, 100].map((mark) => (
              <button
                key={mark}
                type="button"
                onClick={() => handleSliderClick(mark)}
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 transition-all"
                style={{
                  left: `calc(${mark}% - 6px)`,
                  backgroundColor: sliderVal >= mark ? accentColor : BP.bg,
                  borderColor: sliderVal >= mark ? accentColor : BP.border,
                }}
              />
            ))}
          </div>
          <div
            className="flex justify-between text-[10px] font-medium"
            style={{ color: BP.muted }}
          >
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Order value */}
        <div
          className="rounded-lg p-4 flex flex-col gap-2"
          style={{ backgroundColor: BP.inputBg }}
        >
          <span className="text-xs" style={{ color: BP.muted }}>
            Order Value
          </span>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xl font-bold text-white font-mono">
              {orderValue.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <div
              className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ backgroundColor: BP.border }}
            >
              $
            </div>
          </div>
        </div>

        {/* Margin details */}
        <div className="flex flex-col gap-2 text-xs">
          <div className="flex justify-between">
            <span style={{ color: BP.muted }}>Margin Required</span>
            <span className="font-mono text-white">
              {marginRequired > 0
                ? `$${marginRequired.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '--'}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: BP.muted }}>Est. Liquidation Price</span>
            <span className="font-mono text-white">{getEstLiquidationPrice()}</span>
          </div>
        </div>

        {/* Error / success */}
        {errorMsg && (
          <div
            className="text-sm py-3 px-4 rounded-lg"
            style={{
              color: BP.red,
              backgroundColor: BP.errorBg,
              border: `1px solid ${BP.errorBorder}`,
            }}
          >
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div
            className="text-sm py-3 px-4 rounded-lg"
            style={{
              color: BP.green,
              backgroundColor: 'rgba(20, 241, 149, 0.1)',
              border: `1px solid rgba(20, 241, 149, 0.2)`,
            }}
          >
            {successMsg}
          </div>
        )}

        {/* Submit */}
        <div className="pt-1">
          {user && token ? (
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-lg font-bold text-sm transition-all cursor-pointer disabled:opacity-50 text-white"
              style={{ backgroundColor: side === 'LONG' ? BP.green : BP.red }}
            >
              {loading
                ? 'Placing Order...'
                : `${side === 'LONG' ? 'Buy / Long' : 'Sell / Short'} ${symbol}-PERP`}
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setAuthModalMode('signup')}
                className="w-full py-3.5 rounded-lg bg-white text-black hover:bg-zinc-200 font-bold text-sm transition-colors cursor-pointer"
              >
                Sign up to trade
              </button>
              <button
                type="button"
                onClick={() => setAuthModalMode('login')}
                className="w-full py-3.5 rounded-lg font-bold text-sm transition-colors cursor-pointer text-white"
                style={{ backgroundColor: BP.inputBg, border: `1px solid ${BP.border}` }}
              >
                Log in to trade
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
