"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useTrading, type ChartCandle, type ChartInterval } from "../context/TradingContext";
import {
  formatFundingRate,
  fundingRateColorClass,
  FUNDING_INTERVAL_MS,
} from "../utils/funding";
import CandlestickChart from "./CandlestickChart";
import { Activity, ShieldCheck, Clock, FileText } from "lucide-react";

function formatCandleTime(openTime: number, interval: ChartInterval): string {
  const date = new Date(openTime);
  if (interval === "1d") {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function TradingChart() {
  const {
    market,
    lastPrice,
    markPrice,
    previewFundingRate,
    fundingCountdown,
    chartInterval,
    setChartInterval,
    candles,
    loadingCandles,
    wsReady,
    bids,
    asks,
  } = useTrading();

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"chart" | "depth" | "margin" | "funding" | "market_info">("chart");
  const [priceType, setPriceType] = useState<"last" | "mark" | "index">("last");
  const [hoveredCandle, setHoveredCandle] = useState<ChartCandle | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const marketDetails = useMemo(() => {
    if (market === "ETHUSD") {
      return { label: "ETH-PERP", maxLeverage: "50x", mmr: "1.0%", imr: "2.0%", precision: 2, tickSize: "0.01", minQty: "0.01 ETH" };
    }
    if (market === "SOLUSD") {
      return { label: "SOL-PERP", maxLeverage: "20x", mmr: "2.5%", imr: "5.0%", precision: 2, tickSize: "0.01", minQty: "0.1 SOL" };
    }
    return { label: "BTC-PERP", maxLeverage: "75x", mmr: "0.65%", imr: "1.33%", precision: 1, tickSize: "0.1", minQty: "0.001 BTC" };
  }, [market]);

  const activePrice =
    (priceType === "mark" || priceType === "index") && markPrice > 0
      ? markPrice
      : lastPrice > 0
        ? lastPrice
        : markPrice;

  const displayCandle =
    hoveredCandle ?? (candles.length > 0 ? candles[candles.length - 1]! : null);

  const displayFundingRate = previewFundingRate;

  const fundingDirection =
    displayFundingRate === null
      ? "—"
      : displayFundingRate > 0
        ? "Longs pay Shorts"
        : displayFundingRate < 0
          ? "Shorts pay Longs"
          : "Neutral";

  // Depth Chart calculation
  const depthData = useMemo(() => {
    const sortedBids = [...bids].sort((a, b) => b.price - a.price).slice(0, 15);
    const sortedAsks = [...asks].sort((a, b) => a.price - b.price).slice(0, 15);

    let cumBid = 0;
    const bidPoints = sortedBids.map((b) => {
      cumBid += b.size;
      return { price: b.price, total: cumBid };
    });

    let cumAsk = 0;
    const askPoints = sortedAsks.map((a) => {
      cumAsk += a.size;
      return { price: a.price, total: cumAsk };
    });

    const maxDepth = Math.max(cumBid, cumAsk, 0.1);
    return { bidPoints, askPoints, maxDepth, cumBid, cumAsk };
  }, [bids, asks]);

  if (!mounted) {
    return (
      <div className="flex flex-col h-full bg-[#0c0d10] border border-[#171a1f] rounded-lg p-4 select-none font-sans min-h-[500px]" />
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0c0d10] border border-[#171a1f] rounded-lg overflow-hidden select-none font-sans">
      <div className="flex items-center justify-between border-b border-[#171a1f] bg-[#0c0d10] px-3 h-10 shrink-0">
        <div className="flex space-x-1">
          {[
            { id: "chart", label: "Chart" },
            { id: "depth", label: "Depth" },
            { id: "margin", label: "Margin" },
            { id: "funding", label: "Funding" },
            { id: "market_info", label: "Market Info" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-3 py-1 text-xs font-bold transition-colors ${
                activeTab === tab.id
                  ? "text-white border-b-2 border-white"
                  : "text-[#8491a5] hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "chart" && (
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#12161c] border border-[#171a1f] rounded p-0.5 space-x-0.5">
              {(["1h", "1d"] as ChartInterval[]).map((interval) => (
                <button
                  key={interval}
                  onClick={() => setChartInterval(interval)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${
                    chartInterval === interval
                      ? "bg-[#171a1f] text-white"
                      : "text-[#8491a5] hover:text-white"
                  }`}
                >
                  {interval.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="flex items-center bg-[#12161c] border border-[#171a1f] rounded p-0.5 space-x-0.5">
              {[
                { id: "last", label: "Last" },
                { id: "mark", label: "Mark" },
                { id: "index", label: "Index" },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setPriceType(type.id as typeof priceType)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${
                    priceType === type.id
                      ? "bg-[#171a1f] text-white"
                      : "text-[#8491a5] hover:text-white"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {activeTab === "chart" ? (
        <div className="flex-1 flex flex-col min-h-0 bg-[#08090b]">
          <div className="px-4 py-2 flex flex-wrap items-center text-[10px] select-none shrink-0 font-semibold text-zinc-500 gap-1.5 bg-[#08090b]">
            <span className="text-white font-bold text-[11px]">{marketDetails.label}</span>
            <span className="text-zinc-500 font-semibold">
              · {wsReady ? "WS live" : "WS connecting"} · {chartInterval.toUpperCase()} OHLC
            </span>
            {activePrice > 0 && (
              <span className="text-[#00c087] font-mono font-bold ml-2">
                {activePrice.toFixed(marketDetails.precision)}
              </span>
            )}
            {displayCandle && (
              <span className="text-zinc-500 font-mono ml-2">
                O {displayCandle.open.toFixed(marketDetails.precision)} · H{" "}
                {displayCandle.high.toFixed(marketDetails.precision)} · L{" "}
                {displayCandle.low.toFixed(marketDetails.precision)} · C{" "}
                {displayCandle.close.toFixed(marketDetails.precision)} ·{" "}
                {formatCandleTime(displayCandle.openTime, chartInterval)}
              </span>
            )}
          </div>

          <div className="flex-1 w-full bg-[#08090b] relative min-h-[360px]">
            {loadingCandles && candles.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[#8491a5] text-xs">
                {wsReady ? "Loading candle history..." : "Connecting WebSocket..."}
              </div>
            ) : candles.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[#8491a5] text-xs">
                Waiting for orderbook or trade data to build candles...
              </div>
            ) : (
              <CandlestickChart
                candles={candles}
                chartInterval={chartInterval}
                marketLabel={marketDetails.label}
                activePrice={activePrice}
                onHoverCandle={setHoveredCandle}
              />
            )}
          </div>
        </div>
      ) : activeTab === "depth" ? (
        /* Depth Visualization Tab */
        <div className="flex-1 flex flex-col min-h-0 bg-[#08090b] p-4 gap-4 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-[#171a1f] pb-3">
            <div>
              <span className="text-xs font-bold text-white block">Order Book Depth Liquidity</span>
              <span className="text-[10px] text-[#8491a5]">Cumulative buy/sell volume at price levels</span>
            </div>
            <div className="flex items-center space-x-4 text-xs font-mono">
              <span className="text-[#00c087]">Bids: {depthData.cumBid.toFixed(3)}</span>
              <span className="text-[#ff3b30]">Asks: {depthData.cumAsk.toFixed(3)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 flex-1 min-h-[260px]">
            {/* Bid Side */}
            <div className="bg-[#0c0d10] border border-[#171a1f] rounded-lg p-3 flex flex-col">
              <span className="text-[10px] text-[#00c087] font-bold uppercase mb-2">Bid Depth (Cumulative Buys)</span>
              <div className="flex-1 flex flex-col justify-end space-y-1 overflow-hidden">
                {depthData.bidPoints.slice(0, 8).map((point, idx) => {
                  const widthPct = Math.min((point.total / depthData.maxDepth) * 100, 100);
                  return (
                    <div key={`bid-depth-${idx}`} className="flex items-center text-[10px] font-mono justify-between relative py-0.5">
                      <div
                        className="absolute right-0 top-0 bottom-0 bg-[#00c087]/15 rounded"
                        style={{ width: `${widthPct}%` }}
                      />
                      <span className="text-[#00c087] relative z-10">{point.price.toLocaleString()}</span>
                      <span className="text-[#8491a5] relative z-10">{point.total.toFixed(4)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ask Side */}
            <div className="bg-[#0c0d10] border border-[#171a1f] rounded-lg p-3 flex flex-col">
              <span className="text-[10px] text-[#ff3b30] font-bold uppercase mb-2">Ask Depth (Cumulative Sells)</span>
              <div className="flex-1 flex flex-col justify-end space-y-1 overflow-hidden">
                {depthData.askPoints.slice(0, 8).map((point, idx) => {
                  const widthPct = Math.min((point.total / depthData.maxDepth) * 100, 100);
                  return (
                    <div key={`ask-depth-${idx}`} className="flex items-center text-[10px] font-mono justify-between relative py-0.5">
                      <div
                        className="absolute left-0 top-0 bottom-0 bg-[#ff3b30]/15 rounded"
                        style={{ width: `${widthPct}%` }}
                      />
                      <span className="text-[#ff3b30] relative z-10">{point.price.toLocaleString()}</span>
                      <span className="text-[#8491a5] relative z-10">{point.total.toFixed(4)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === "margin" ? (
        /* Margin & Leverage Specifications Tab */
        <div className="flex-1 flex flex-col min-h-0 bg-[#08090b] p-4 gap-4 overflow-y-auto">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#0c0d10] border border-[#171a1f] rounded-lg p-3">
              <div className="flex items-center space-x-2 text-[#8491a5] mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[10px] uppercase font-bold">Max Leverage</span>
              </div>
              <span className="font-mono text-xl font-bold text-white">{marketDetails.maxLeverage}</span>
              <span className="text-[10px] text-[#5d6b7e] block mt-1">Cross & Isolated Margin</span>
            </div>

            <div className="bg-[#0c0d10] border border-[#171a1f] rounded-lg p-3">
              <div className="flex items-center space-x-2 text-[#8491a5] mb-1">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] uppercase font-bold">Initial Margin</span>
              </div>
              <span className="font-mono text-xl font-bold text-[#00c087]">{marketDetails.imr}</span>
              <span className="text-[10px] text-[#5d6b7e] block mt-1">Required to open position</span>
            </div>

            <div className="bg-[#0c0d10] border border-[#171a1f] rounded-lg p-3">
              <div className="flex items-center space-x-2 text-[#8491a5] mb-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] uppercase font-bold">Maintenance Margin</span>
              </div>
              <span className="font-mono text-xl font-bold text-[#f59e0b]">{marketDetails.mmr}</span>
              <span className="text-[10px] text-[#5d6b7e] block mt-1">Liquidation buffer</span>
            </div>
          </div>

          <div className="bg-[#0c0d10] border border-[#171a1f] rounded-lg p-4 space-y-3">
            <span className="text-xs font-bold text-white block">Liquidation & Margin Rules</span>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5 text-[#8491a5]">
                <div className="flex justify-between">
                  <span>Liquidation Fee:</span>
                  <span className="text-white font-mono">0.50%</span>
                </div>
                <div className="flex justify-between">
                  <span>Margin Call Threshold:</span>
                  <span className="text-white font-mono">{marketDetails.mmr}</span>
                </div>
              </div>
              <div className="space-y-1.5 text-[#8491a5]">
                <div className="flex justify-between">
                  <span>Settlement Asset:</span>
                  <span className="text-white font-mono">USD</span>
                </div>
                <div className="flex justify-between">
                  <span>ADL Priority:</span>
                  <span className="text-white font-mono">Highest PnL / Leverage</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === "funding" ? (
        /* Funding Rate Tab */
        <div className="flex-1 flex flex-col min-h-0 bg-[#08090b] p-4 gap-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0c0d10] border border-[#171a1f] rounded-lg p-3">
              <span className="text-[10px] text-[#8491a5] uppercase font-bold block mb-1">
                Est. Funding Rate
              </span>
              <span
                className={`font-mono text-lg font-bold ${displayFundingRate !== null ? fundingRateColorClass(displayFundingRate) : "text-[#8491a5]"}`}
              >
                {displayFundingRate !== null ? formatFundingRate(displayFundingRate) : "—"}
              </span>
              <span className="text-[10px] text-[#5d6b7e] block mt-1">{fundingDirection}</span>
            </div>

            <div className="bg-[#0c0d10] border border-[#171a1f] rounded-lg p-3">
              <span className="text-[10px] text-[#8491a5] uppercase font-bold block mb-1">
                Next Funding In
              </span>
              <span className="font-mono text-lg font-bold text-white">{fundingCountdown}</span>
              <span className="text-[10px] text-[#5d6b7e] block mt-1">
                Every {FUNDING_INTERVAL_MS / (60 * 60 * 1000)}h
              </span>
            </div>
          </div>

          <div className="bg-[#0c0d10] border border-[#171a1f] rounded-lg p-3 space-y-2">
            <span className="text-[10px] text-[#8491a5] uppercase font-bold block">
              Rate Inputs
            </span>
            <div className="flex justify-between text-xs">
              <span className="text-[#8491a5]">Mark Price (external oracle)</span>
              <span className="font-mono text-white">
                {markPrice > 0 ? markPrice.toFixed(marketDetails.precision) : "—"}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#8491a5]">Last Traded Price</span>
              <span className="font-mono text-white">
                {lastPrice > 0 ? lastPrice.toFixed(marketDetails.precision) : "—"}
              </span>
            </div>
            <p className="text-[10px] text-[#5d6b7e] leading-relaxed pt-1">
              Rate = clamp((Last − Mark) / Mark, −0.05%, +0.05%). Premium → longs pay shorts.
              Discount → shorts pay longs.
            </p>
          </div>
        </div>
      ) : (
        /* Market Info Tab */
        <div className="flex-1 flex flex-col min-h-0 bg-[#08090b] p-4 gap-4 overflow-y-auto">
          <div className="flex items-center space-x-2 text-white border-b border-[#171a1f] pb-3">
            <FileText className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold">{marketDetails.label} Contract Specifications</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-[#0c0d10] border border-[#171a1f] rounded-lg p-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-[#8491a5]">Contract Type:</span>
                <span className="text-white font-mono font-semibold">Perpetual Linear</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8491a5]">Settlement Asset:</span>
                <span className="text-white font-mono font-semibold">USD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8491a5]">Tick Size:</span>
                <span className="text-white font-mono font-semibold">{marketDetails.tickSize} USD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8491a5]">Minimum Order:</span>
                <span className="text-white font-mono font-semibold">{marketDetails.minQty}</span>
              </div>
            </div>

            <div className="bg-[#0c0d10] border border-[#171a1f] rounded-lg p-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-[#8491a5]">Price Oracle:</span>
                <span className="text-emerald-400 font-mono font-semibold">Binance Futures (1s)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8491a5]">Funding Interval:</span>
                <span className="text-white font-mono font-semibold">8 Hours</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8491a5]">Max Leverage:</span>
                <span className="text-blue-400 font-mono font-semibold">{marketDetails.maxLeverage}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8491a5]">Trading Hours:</span>
                <span className="text-white font-mono font-semibold">24/7/365</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
