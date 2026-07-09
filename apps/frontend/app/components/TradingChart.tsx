"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useTrading, type ChartCandle, type ChartInterval } from "../context/TradingContext";
import {
  formatFundingRate,
  fundingRateColorClass,
  FUNDING_INTERVAL_MS,
} from "../utils/funding";
import CandlestickChart from "./CandlestickChart";

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
      return { label: "ETH-PERP", precision: 2 };
    }
    if (market === "SOLUSD") {
      return { label: "SOL-PERP", precision: 2 };
    }
    return { label: "BTC-PERP", precision: 1 };
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
      ) : activeTab === "funding" ? (
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
              <span className="text-[#8491a5]">Mark Price (external)</span>
              <span className="font-mono text-white">
                {markPrice > 0 ? markPrice.toFixed(marketDetails.precision) : "—"}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#8491a5]">Last Price (local)</span>
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
        <div className="flex-1 flex flex-col items-center justify-center text-[#8491a5] font-sans text-xs">
          <span>{activeTab.replace("_", " ")} — no data available from backend</span>
        </div>
      )}
    </div>
  );
}
