"use client";

import React, { useState } from "react";
import { useTrading } from "../context/TradingContext";
import { Lock, Unlock, Minus, Plus } from "lucide-react";

export default function OrderBook() {
  const { bids, asks, lastPrice, markPrice, marketTrades, marketLiquidations, market, loadingDepth } = useTrading();
  const [activeTab, setActiveTab] = useState<"book" | "trades" | "liquidations">("book");
  const [layout, setLayout] = useState<"both" | "asks" | "bids">("both");
  const [isLocked, setIsLocked] = useState(true);
  const [precision, setPrecision] = useState(0.1);

  const getAssetSymbol = () => {
    if (market === "ETHUSD") return "ETH";
    if (market === "SOLUSD") return "SOL";
    return "BTC";
  };

  const asset = getAssetSymbol();

  const handlePrecisionChange = (action: "inc" | "dec") => {
    if (action === "inc") {
      if (precision === 0.1) setPrecision(1);
      else if (precision === 1) setPrecision(10);
    } else {
      if (precision === 10) setPrecision(1);
      else if (precision === 1) setPrecision(0.1);
    }
  };

  const formatPrice = (price: number) => {
    if (precision === 0.1) return price.toFixed(1);
    return price.toFixed(0);
  };

  const formatDisplayPrice = (price: number) => {
    if (price <= 0) return "—";
    return price.toLocaleString(undefined, { minimumFractionDigits: 1 });
  };

  const groupOrders = (orders: typeof bids, isBid: boolean) => {
    const grouped: { [key: string]: { price: number; size: number } } = {};
    orders.forEach((o) => {
      const roundedPrice = Math.round(o.price / precision) * precision;
      const key = roundedPrice.toFixed(precision === 0.1 ? 1 : 0);
      if (!grouped[key]) {
        grouped[key] = { price: roundedPrice, size: 0 };
      }
      grouped[key].size += o.size;
    });

    const list = Object.values(grouped).sort((a, b) =>
      isBid ? b.price - a.price : a.price - b.price
    );

    let accum = 0;
    return list.map((item) => {
      accum += item.size;
      return { ...item, total: accum };
    });
  };

  const groupedBids = groupOrders(bids, true);
  const groupedAsks = groupOrders(asks, false);

  const maxRows = layout === "both" ? 12 : 24;
  const displayedAsks = layout === "bids" ? [] : groupedAsks.slice(0, maxRows);
  const displayedBids = layout === "asks" ? [] : groupedBids.slice(0, maxRows);
  const asksToRender = layout === "both" ? [...displayedAsks].reverse() : displayedAsks;

  const maxTotalAsks = displayedAsks.length > 0 ? Math.max(...displayedAsks.map((a) => a.total)) : 1;
  const maxTotalBids = displayedBids.length > 0 ? Math.max(...displayedBids.map((b) => b.total)) : 1;

  return (
    <div className="flex flex-col h-full bg-[#0c0d10] border border-[#171a1f] rounded-lg overflow-hidden select-none font-sans">
      <div className="flex items-center justify-between border-b border-[#171a1f] bg-[#0c0d10] px-3 h-10 shrink-0">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab("book")}
            className={`px-3 py-1 text-xs font-bold transition-colors ${
              activeTab === "book" ? "text-white border-b-2 border-white" : "text-[#8491a5] hover:text-white"
            }`}
          >
            Book
          </button>
          <button
            onClick={() => setActiveTab("trades")}
            className={`px-3 py-1 text-xs font-bold transition-colors ${
              activeTab === "trades" ? "text-white border-b-2 border-white" : "text-[#8491a5] hover:text-white"
            }`}
          >
            Trades
          </button>
          <button
            onClick={() => setActiveTab("liquidations")}
            className={`px-3 py-1 text-xs font-bold transition-colors ${
              activeTab === "liquidations" ? "text-white border-b-2 border-white" : "text-[#8491a5] hover:text-white"
            }`}
          >
            Liquidation
          </button>
        </div>
      </div>

      {activeTab === "book" ? (
        <>
          <div className="flex items-center justify-between px-3 h-9 bg-[#0c0d10] border-b border-[#171a1f] shrink-0">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setLayout("both")}
                className={`p-1 rounded transition-colors ${
                  layout === "both" ? "bg-[#171a1f] text-white" : "text-[#8491a5] hover:text-white"
                }`}
                title="Show both buys and sells"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M4 6h16M4 12h16M4 18h16" className={layout === "both" ? "stroke-white" : "stroke-zinc-500"} />
                  <path d="M4 6h16" className="stroke-red-500" />
                  <path d="M4 18h16" className="stroke-emerald-500" />
                </svg>
              </button>
              <button
                onClick={() => setLayout("asks")}
                className={`p-1 rounded transition-colors ${
                  layout === "asks" ? "bg-[#171a1f] text-white" : "text-[#8491a5] hover:text-white"
                }`}
                title="Show sells only"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M4 6h16M4 12h16M4 18h16" className="stroke-red-500" />
                </svg>
              </button>
              <button
                onClick={() => setLayout("bids")}
                className={`p-1 rounded transition-colors ${
                  layout === "bids" ? "bg-[#171a1f] text-white" : "text-[#8491a5] hover:text-white"
                }`}
                title="Show buys only"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M4 6h16M4 12h16M4 18h16" className="stroke-emerald-500" />
                </svg>
              </button>

              <button
                onClick={() => setIsLocked(!isLocked)}
                className="text-[#8491a5] hover:text-white p-1 rounded transition-colors"
              >
                {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex items-center bg-[#12161c] border border-[#171a1f] rounded px-1.5 h-6">
              <button
                onClick={() => handlePrecisionChange("dec")}
                className="text-[#8491a5] hover:text-white disabled:opacity-30"
                disabled={precision <= 0.1}
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-[10px] text-white font-mono px-2 font-semibold">{precision}</span>
              <button
                onClick={() => handlePrecisionChange("inc")}
                className="text-[#8491a5] hover:text-white disabled:opacity-30"
                disabled={precision >= 10}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 text-[10px] font-bold text-[#8491a5] px-3 py-1.5 border-b border-[#171a1f] bg-[#0c0d10] shrink-0">
            <div>Price (USD)</div>
            <div className="text-right">Size ({asset})</div>
            <div className="text-right">Total ({asset})</div>
          </div>

          <div className="flex-1 flex flex-col justify-between overflow-y-auto no-scrollbar font-mono text-xs">
            {loadingDepth ? (
              <div className="flex-1 flex items-center justify-center text-zinc-600 text-[10px]">
                Loading order book...
              </div>
            ) : (
              <>
                {layout !== "bids" && (
                  <div className="flex-1 flex flex-col justify-end min-h-[100px] overflow-hidden">
                    {asksToRender.length === 0 ? (
                      <div className="text-center text-zinc-600 text-[10px] py-4">No Asks</div>
                    ) : (
                      asksToRender.map((ask, idx) => {
                        const depthPercent = Math.min((ask.total / maxTotalAsks) * 100, 100);
                        return (
                          <div
                            key={`ask-${idx}`}
                            className="relative grid grid-cols-3 px-3 py-0.5 hover:bg-white/[0.02] cursor-pointer items-center"
                            style={{
                              background: `linear-gradient(to left, rgba(239, 68, 68, 0.08) ${depthPercent}%, transparent ${depthPercent}%)`,
                            }}
                          >
                            <div className="text-[#ff3b30] font-bold">{formatPrice(ask.price)}</div>
                            <div className="text-right text-[#b0bbcb]">{ask.size.toFixed(5)}</div>
                            <div className="text-right text-[#5d6b7e]">{ask.total.toFixed(5)}</div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between px-3 py-2 bg-[#12161c]/40 border-y border-[#171a1f] shrink-0">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-sm font-bold ${
                        lastPrice > 0 && markPrice > 0
                          ? lastPrice >= markPrice
                            ? "text-[#00c087]"
                            : "text-[#ff3b30]"
                          : "text-white"
                      }`}
                    >
                      {formatDisplayPrice(lastPrice)}
                    </span>
                    <span className="text-[10px] text-[#8491a5] font-semibold">
                      {formatDisplayPrice(markPrice)}
                    </span>
                  </div>
                </div>

                {layout !== "asks" && (
                  <div className="flex-1 flex flex-col justify-start min-h-[100px] overflow-hidden">
                    {displayedBids.length === 0 ? (
                      <div className="text-center text-zinc-600 text-[10px] py-4">No Bids</div>
                    ) : (
                      displayedBids.map((bid, idx) => {
                        const depthPercent = Math.min((bid.total / maxTotalBids) * 100, 100);
                        return (
                          <div
                            key={`bid-${idx}`}
                            className="relative grid grid-cols-3 px-3 py-0.5 hover:bg-white/[0.02] cursor-pointer items-center"
                            style={{
                              background: `linear-gradient(to left, rgba(0, 192, 135, 0.08) ${depthPercent}%, transparent ${depthPercent}%)`,
                            }}
                          >
                            <div className="text-[#00c087] font-bold">{formatPrice(bid.price)}</div>
                            <div className="text-right text-[#b0bbcb]">{bid.size.toFixed(5)}</div>
                            <div className="text-right text-[#5d6b7e]">{bid.total.toFixed(5)}</div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      ) : activeTab === "trades" ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="grid grid-cols-3 text-[10px] font-bold text-[#8491a5] px-3 py-1.5 border-b border-[#171a1f] bg-[#0c0d10] shrink-0">
            <div>Time</div>
            <div className="text-right">Price (USD)</div>
            <div className="text-right">Quantity ({asset})</div>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar font-mono text-xs divide-y divide-[#171a1f]/20">
            {marketTrades.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-[#8491a5] font-sans">
                <span>No market trades yet</span>
              </div>
            ) : (
              marketTrades.map((trade, idx) => (
                <div
                  key={`trade-${trade.time}-${idx}`}
                  className="grid grid-cols-3 px-3 py-1.5 hover:bg-white/[0.02] items-center"
                >
                  <div className="text-[#8491a5] text-[10px]">
                    {new Date(trade.time).toLocaleTimeString()}
                  </div>
                  <div className="text-right text-white font-bold">
                    {trade.price.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                  </div>
                  <div className="text-right text-[#b0bbcb]">{trade.qty.toFixed(5)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-[#171a1f] bg-[#12161c]/40 shrink-0">
            <p className="text-[10px] text-[#8491a5] leading-relaxed">
              Liquidations trigger when mark price moves against a position past its maintenance margin.
            </p>
          </div>
          <div className="grid grid-cols-4 text-[10px] font-bold text-[#8491a5] px-3 py-1.5 border-b border-[#171a1f] bg-[#0c0d10] shrink-0">
            <div>Time</div>
            <div>Side</div>
            <div className="text-right">Price (USD)</div>
            <div className="text-right">Quantity ({asset})</div>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar font-mono text-xs divide-y divide-[#171a1f]/20">
            {marketLiquidations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-[#8491a5] font-sans">
                <span>No liquidations yet</span>
              </div>
            ) : (
              marketLiquidations.map((liq, idx) => (
                <div
                  key={`liq-${liq.time}-${liq.userId}-${idx}`}
                  className="grid grid-cols-4 px-3 py-1.5 hover:bg-white/[0.02] items-center"
                >
                  <div className="text-[#8491a5] text-[10px]">
                    {new Date(liq.time).toLocaleTimeString()}
                  </div>
                  <div className={liq.kind === "LONG" ? "text-[#ff3b30]" : "text-[#00c087]"}>
                    {liq.kind}
                  </div>
                  <div className="text-right text-white font-bold">
                    {liq.price.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                  </div>
                  <div className="text-right text-[#b0bbcb]">{liq.qty.toFixed(5)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
