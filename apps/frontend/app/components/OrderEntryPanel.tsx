"use client";

import React, { useState, useEffect } from "react";
import { useTrading } from "../context/TradingContext";
import { ChevronDown } from "lucide-react";

export default function OrderEntryPanel() {
  const {
    market,
    balance,
    lastPrice,
    user,
    setAuthModalMode,
    placeOrder,
    refreshUserData
  } = useTrading();

  const [side, setSide] = useState<"LONG" | "SHORT">("LONG");
  const [orderType, setOrderType] = useState<"LIMIT" | "MARKET" | "CONDITIONAL">("LIMIT");
  
  const [priceInput, setPriceInput] = useState("");
  const [qtyInput, setQtyInput] = useState("");
  const [sliderVal, setSliderVal] = useState(0);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Map market to asset details
  const getMarketInfo = () => {
    if (market === "ETHUSD") {
      return { symbol: "ETH", leverage: 50, color: "bg-[#627eea]" };
    }
    if (market === "SOLUSD") {
      return { symbol: "SOL", leverage: 20, color: "bg-[#14f195]" };
    }
    return { symbol: "BTC", leverage: 75, color: "bg-[#f7931a]" };
  };

  const { symbol, leverage, color } = getMarketInfo();

  // Populate price when lastPrice changes or clicking Mid/BBO
  useEffect(() => {
    if (lastPrice > 0 && !priceInput) {
      setPriceInput(lastPrice.toString());
    }
  }, [lastPrice]);

  const handleMidBBO = (type: "MID" | "BBO") => {
    if (lastPrice > 0) {
      if (type === "MID") {
        setPriceInput(lastPrice.toString());
      } else {
        // Best Bid Offer approximation
        const spread = side === "LONG" ? lastPrice * 0.999 : lastPrice * 1.001;
        setPriceInput(spread.toFixed(1));
      }
    }
  };

  const priceVal = parseFloat(priceInput) || 0;
  const qtyVal = parseFloat(qtyInput) || 0;
  const orderValue = priceVal * qtyVal;
  const marginRequired = orderValue > 0 ? orderValue / leverage : 0;

  // Handle slider changes
  const handleSliderClick = (percent: number) => {
    setSliderVal(percent);
    if (balance > 0 && priceVal > 0) {
      // qty = (balance * percent / 100) * leverage / price
      const calculatedQty = ((balance * (percent / 100)) * leverage) / priceVal;
      setQtyInput(calculatedQty.toFixed(4));
    }
  };

  // Synchronize order value updates back to quantity if needed, or simply calculate
  const handleQtyChange = (val: string) => {
    setQtyInput(val);
    const parsed = parseFloat(val) || 0;
    if (balance > 0 && priceVal > 0) {
      const margin = (parsed * priceVal) / leverage;
      const pct = (margin / balance) * 100;
      setSliderVal(Math.min(Math.round(pct), 100));
    }
  };

  // Submit Order
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!user) {
      setAuthModalMode("login");
      return;
    }

    if (qtyVal <= 0) {
      setErrorMsg("Quantity must be greater than 0");
      return;
    }

    if (orderType === "LIMIT" && priceVal <= 0) {
      setErrorMsg("Price must be greater than 0");
      return;
    }

    setLoading(true);
    try {
      const finalPrice = orderType === "MARKET" ? lastPrice || priceVal : priceVal;
      await placeOrder(
        qtyInput,
        finalPrice,
        orderType === "LIMIT" ? "LIMIT" : "MARKET",
        side,
        marginRequired
      );
      setSuccessMsg(`Successfully placed ${side} order for ${qtyInput} ${symbol}`);
      setQtyInput("");
      setSliderVal(0);
      refreshUserData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to place order");
    } finally {
      setLoading(false);
    }
  };

  // Estimation of Liquidation Price
  const getEstLiquidationPrice = () => {
    if (qtyVal <= 0 || priceVal <= 0) return "--";
    // Approx: Price * (1 -/+ 1/leverage)
    const direction = side === "LONG" ? -1 : 1;
    const maintenanceMargin = 0.005; // 0.5% maintenance
    const liqPrice = priceVal * (1 + direction * (1 / leverage - maintenanceMargin));
    return `$${liqPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  };

  return (
    <div className="flex flex-col h-full bg-[#0c0d10] border border-[#171a1f] rounded-lg p-4 text-[#f2f4f7] select-none font-sans justify-between min-h-[500px]">
      <form onSubmit={handleSubmitOrder} className="flex flex-col space-y-4">
        {/* Buy/Long & Sell/Short Switcher */}
        <div className="grid grid-cols-2 bg-[#12161c] rounded-xl p-1 h-12 shrink-0">
          <button
            type="button"
            onClick={() => setSide("LONG")}
            className={`rounded-lg font-bold text-xs transition-all ${
              side === "LONG"
                ? "bg-[#0f241d] text-[#00c087] border border-[#00c087]/20"
                : "text-[#8491a5] hover:text-white"
            }`}
          >
            Buy / Long
          </button>
          <button
            type="button"
            onClick={() => setSide("SHORT")}
            className={`rounded-lg font-bold text-xs transition-all ${
              side === "SHORT"
                ? "bg-[#291717] text-[#ff3b30] border border-[#ff3b30]/20"
                : "text-[#8491a5] hover:text-white"
            }`}
          >
            Sell / Short
          </button>
        </div>

        {/* Order Type Tabs */}
        <div className="flex items-center space-x-4 border-b border-[#171a1f] pb-2 text-xs">
          {["LIMIT", "MARKET", "CONDITIONAL"].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setOrderType(type as any)}
              className={`font-semibold transition-colors flex items-center ${
                orderType === type ? "text-white" : "text-[#8491a5] hover:text-white"
              }`}
            >
              {type === "LIMIT" ? "Limit" : type === "MARKET" ? "Market" : "Conditional"}
              {type === "CONDITIONAL" && <ChevronDown className="w-3 h-3 ml-1" />}
            </button>
          ))}
        </div>

        {/* Available Equity */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#8491a5]">Available Equity</span>
          <span className="font-mono font-bold text-white">
            ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Price Input Block */}
        {orderType !== "MARKET" && (
          <div className="bg-[#12161c] border border-[#171a1f] rounded-xl p-3 flex flex-col justify-between h-18">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#8491a5]">Price</span>
              <div className="flex space-x-2 text-[10px]">
                <button
                  type="button"
                  onClick={() => handleMidBBO("MID")}
                  className="text-blue-400 hover:underline font-semibold"
                >
                  Mid
                </button>
                <span className="text-zinc-600">|</span>
                <button
                  type="button"
                  onClick={() => handleMidBBO("BBO")}
                  className="text-blue-400 hover:underline font-semibold"
                >
                  BBO
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between mt-1">
              <input
                type="text"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder="0.0"
                className="w-full bg-transparent text-sm text-white font-bold outline-none font-mono"
              />
              <div className="bg-[#171a1f] px-2 py-0.5 rounded text-[10px] text-white flex items-center justify-center font-bold">
                $
              </div>
            </div>
          </div>
        )}

        {/* Quantity Input Block */}
        <div className="bg-[#12161c] border border-[#171a1f] rounded-xl p-3 flex flex-col justify-between h-18">
          <span className="text-[10px] font-bold text-[#8491a5]">Quantity</span>
          <div className="flex items-center justify-between mt-1">
            <input
              type="text"
              value={qtyInput}
              onChange={(e) => handleQtyChange(e.target.value)}
              placeholder="0"
              className="w-full bg-transparent text-sm text-white font-bold outline-none font-mono"
            />
            <div className={`px-2 py-0.5 rounded text-[10px] text-black flex items-center justify-center font-bold ${color}`}>
              {symbol}
            </div>
          </div>
        </div>

        {/* Percentage Slider Selector */}
        <div className="flex flex-col space-y-1 py-1">
          <div className="relative w-full h-1 bg-[#171a1f] rounded">
            {/* Slider bar */}
            <div
              className={`absolute top-0 left-0 h-full rounded ${side === "LONG" ? "bg-[#00c087]" : "bg-[#ff3b30]"}`}
              style={{ width: `${sliderVal}%` }}
            />
            {/* Markers */}
            {[0, 25, 50, 75, 100].map((mark) => (
              <button
                key={mark}
                type="button"
                onClick={() => handleSliderClick(mark)}
                className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 transition-all flex items-center justify-center ${
                  sliderVal >= mark
                    ? side === "LONG"
                      ? "bg-[#00c087] border-[#00c087]"
                      : "bg-[#ff3b30] border-[#ff3b30]"
                    : "bg-[#0c0d10] border-[#171a1f] hover:border-zinc-500"
                }`}
                style={{ left: `calc(${mark}% - 7px)` }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[9px] text-[#8491a5] font-semibold px-0.5 pt-1">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Order Value Block */}
        <div className="bg-[#12161c] border border-[#171a1f] rounded-xl p-3 flex flex-col justify-between h-18">
          <span className="text-[10px] font-bold text-[#8491a5]">Order Value</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm font-bold text-white font-mono">
              {orderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <div className="bg-[#171a1f] px-2 py-0.5 rounded text-[10px] text-white flex items-center justify-center font-bold">
              $
            </div>
          </div>
        </div>

        {/* Extra Statistics */}
        <div className="flex flex-col space-y-2 border-t border-[#171a1f] pt-3 text-[11px] font-semibold">
          <div className="flex justify-between">
            <span className="text-[#8491a5]">Margin Required</span>
            <span className="font-mono text-zinc-300">
              {marginRequired > 0
                ? `$${marginRequired.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : "--"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8491a5]">Est. Liquidation Price</span>
            <span className="font-mono text-zinc-300">{getEstLiquidationPrice()}</span>
          </div>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 py-2 px-3 rounded-lg text-center">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="text-xs text-[#00c087] bg-[#00c087]/10 border border-[#00c087]/20 py-2 px-3 rounded-lg text-center">
            {successMsg}
          </div>
        )}

        {/* CTA Login/Signup/Trade Buttons */}
        <div className="flex flex-col space-y-2 pt-2">
          {user ? (
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer text-black ${
                side === "LONG"
                  ? "bg-[#00c087] hover:bg-[#00a875] text-white"
                  : "bg-[#ff3b30] hover:bg-[#e02e24] text-white"
              } disabled:opacity-50`}
            >
              {loading ? "Placing Order..." : `${side === "LONG" ? "Buy / Long" : "Sell / Short"} ${symbol}-PERP`}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setAuthModalMode("signup")}
                className="w-full py-3.5 rounded-xl bg-white text-black hover:bg-zinc-200 font-bold text-xs shadow-sm transition-colors cursor-pointer text-center"
              >
                Sign up to trade
              </button>
              <button
                type="button"
                onClick={() => setAuthModalMode("login")}
                className="w-full py-3.5 rounded-xl bg-[#1d222b] text-white hover:bg-zinc-800 font-bold text-xs shadow-sm transition-colors cursor-pointer text-center"
              >
                Log in to trade
              </button>
            </>
          )}
        </div>
      </form>

      {/* Checkboxes and Bottom Yield */}
      <div className="flex flex-col space-y-4 border-t border-[#171a1f] pt-4 mt-4 text-[10px] font-semibold text-[#8491a5]">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center space-x-1.5 cursor-pointer">
            <input type="checkbox" className="rounded border-zinc-700 bg-black text-blue-500 focus:ring-0" />
            <span>Post Only</span>
          </label>
          <label className="flex items-center space-x-1.5 cursor-pointer">
            <input type="checkbox" className="rounded border-zinc-700 bg-black text-blue-500 focus:ring-0" />
            <span>IOC</span>
          </label>
          <label className="flex items-center space-x-1.5 cursor-pointer">
            <input type="checkbox" className="rounded border-zinc-700 bg-black text-blue-500 focus:ring-0" />
            <span>Reduce Only</span>
          </label>
          <label className="flex items-center space-x-1.5 cursor-pointer">
            <input type="checkbox" className="rounded border-zinc-700 bg-black text-blue-500 focus:ring-0" />
            <span>TP/SL</span>
          </label>
        </div>

        <div className="flex justify-between border-t border-[#171a1f]/40 pt-2 items-center">
          <span>Hourly Yield</span>
          <span className="font-mono text-zinc-300 font-bold">$0.00</span>
        </div>
      </div>
    </div>
  );
}
