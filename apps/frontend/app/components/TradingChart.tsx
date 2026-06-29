"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useTrading } from "../context/TradingContext";
import {
  formatFundingRate,
  fundingRateColorClass,
  FUNDING_INTERVAL_MS,
} from "../utils/funding";

export default function TradingChart() {
  const { market, lastPrice, markPrice, previewFundingRate, fundingCountdown } = useTrading();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"chart" | "depth" | "margin" | "funding" | "market_info">("chart");
  const [priceType, setPriceType] = useState<"last" | "mark" | "index">("last");

  const containerRef = useRef<HTMLDivElement>(null);
  const [mouseCoords, setMouseCoords] = useState<{ x: number; y: number } | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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

  const chartData = useMemo(() => {
    const fallbackPrice = lastPrice > 0 ? lastPrice : markPrice > 0 ? markPrice : 0;
    if (fallbackPrice <= 0) return [];
    return [{ time: "—", price: fallbackPrice }];
  }, [lastPrice, markPrice]);

  const activePrice =
    (priceType === "mark" || priceType === "index") && markPrice > 0
      ? markPrice
      : lastPrice > 0
        ? lastPrice
        : markPrice;

  const { minPrice, maxPrice, priceRange, scaleY } = useMemo(() => {
    if (chartData.length === 0) {
      return {
        minPrice: 0,
        maxPrice: 0,
        priceRange: 0,
        scaleY: () => 0,
      };
    }

    const prices = chartData.map((d) => d.price);
    const maxVal = Math.max(...prices) * 1.002;
    const minVal = Math.min(...prices) * 0.998;
    const range = maxVal - minVal || 1;
    const chartHeight = 300;
    const padding = 15;

    return {
      minPrice: minVal,
      maxPrice: maxVal,
      priceRange: range,
      scaleY: (price: number) =>
        chartHeight - padding - ((price - minVal) / range) * (chartHeight - 2 * padding),
    };
  }, [chartData]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (chartData.length === 0) return;
    const svgRect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - svgRect.left;
    setMouseCoords({ x, y: e.clientY - svgRect.top });

    const chartWidth = svgRect.width - 55;
    const step = chartWidth / chartData.length;
    const index = Math.min(Math.max(Math.floor(x / step), 0), chartData.length - 1);
    setHoveredIndex(index);
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
    setMouseCoords(null);
  };

  const getHoverPrice = () => {
    if (!mouseCoords) return 0;
    const chartHeight = 300;
    const padding = 15;
    const relativeY = chartHeight - padding - mouseCoords.y;
    return minPrice + (relativeY / (chartHeight - 2 * padding)) * priceRange;
  };

  const hoveredPoint = hoveredIndex !== null ? chartData[hoveredIndex] : chartData[chartData.length - 1];

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
    <div
      className="flex flex-col h-full bg-[#0c0d10] border border-[#171a1f] rounded-lg overflow-hidden select-none font-sans"
      ref={containerRef}
    >
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

      {activeTab === "chart" ? (
        <div className="flex-1 flex flex-col min-h-0 bg-[#08090b]">
          <div className="px-4 py-2 flex flex-wrap items-center text-[10px] select-none shrink-0 font-semibold text-zinc-500 gap-1.5 bg-[#08090b]">
            <span className="text-white font-bold text-[11px]">{marketDetails.label}</span>
            <span className="text-zinc-500 font-semibold">· Live · Backpack</span>
            {activePrice > 0 && (
              <span className="text-[#00c087] font-mono font-bold ml-2">
                {activePrice.toFixed(marketDetails.precision)}
              </span>
            )}
            {hoveredPoint && chartData.length > 1 && (
              <span className="text-zinc-500 font-mono ml-2">
                {hoveredPoint.time} · {hoveredPoint.price.toFixed(marketDetails.precision)}
              </span>
            )}
          </div>

          <div className="flex-1 w-full bg-[#08090b] relative overflow-hidden">
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[#8491a5] text-xs">
                Waiting for live price data...
              </div>
            ) : (
              <svg
                className="w-full h-full cursor-crosshair overflow-hidden"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                {Array.from({ length: 6 }).map((_, idx) => {
                  const price = minPrice + (priceRange / 5) * idx;
                  const y = scaleY(price);
                  return (
                    <g key={`grid-line-${idx}`}>
                      <line x1={0} y1={y} x2="100%" y2={y} stroke="#12161c" strokeWidth={1} />
                      <text
                        x="100%"
                        dx={-48}
                        y={y + 4}
                        fill="#4b5563"
                        className="font-mono text-[9px] font-bold text-right"
                      >
                        {price.toFixed(marketDetails.precision)}
                      </text>
                    </g>
                  );
                })}

                {chartData.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#00c087"
                    strokeWidth={1.5}
                    points={chartData
                      .map((d, idx) => {
                        const step = 90 / chartData.length;
                        const x = `${idx * step + 2}%`;
                        const y = scaleY(d.price);
                        return `${x},${y}`;
                      })
                      .join(" ")}
                  />
                )}

                {chartData.map((d, idx) => {
                  const step = 90 / chartData.length;
                  const xPct = `${idx * step + 2}%`;
                  const y = scaleY(d.price);
                  return (
                    <circle
                      key={`point-${idx}`}
                      cx={xPct}
                      cy={y}
                      r={chartData.length === 1 ? 4 : 2}
                      fill="#00c087"
                    />
                  );
                })}

                {activePrice > 0 && (
                  <g>
                    <line
                      x1="0"
                      y1={scaleY(activePrice)}
                      x2="100%"
                      y2={scaleY(activePrice)}
                      stroke="#00c087"
                      strokeWidth={1}
                      strokeDasharray="2,3"
                      opacity={0.7}
                    />
                    <rect
                      x="100%"
                      transform="translate(-52, -7)"
                      y={scaleY(activePrice)}
                      width="50"
                      height="14"
                      rx={2}
                      fill="#00c087"
                    />
                    <text
                      x="100%"
                      dx={-27}
                      y={scaleY(activePrice) + 3}
                      textAnchor="middle"
                      fill="#08090b"
                      className="font-mono text-[9px] font-bold"
                    >
                      {activePrice.toFixed(marketDetails.precision)}
                    </text>
                  </g>
                )}

                {mouseCoords && chartData.length > 1 && (
                  <g>
                    <line
                      x1={mouseCoords.x}
                      y1={0}
                      x2={mouseCoords.x}
                      y2="85%"
                      stroke="#5d6b7e"
                      strokeWidth={1}
                      strokeDasharray="3,3"
                      opacity={0.6}
                    />
                    <line
                      x1={0}
                      y1={mouseCoords.y}
                      x2="100%"
                      y2={mouseCoords.y}
                      stroke="#5d6b7e"
                      strokeWidth={1}
                      strokeDasharray="3,3"
                      opacity={0.6}
                    />
                    <rect
                      x="100%"
                      transform="translate(-52, -7)"
                      y={mouseCoords.y}
                      width="50"
                      height="14"
                      rx={2}
                      fill="#1f2937"
                    />
                    <text
                      x="100%"
                      dx={-27}
                      y={mouseCoords.y + 3}
                      textAnchor="middle"
                      fill="#f3f4f6"
                      className="font-mono text-[9px] font-bold"
                    >
                      {getHoverPrice().toFixed(marketDetails.precision)}
                    </text>
                  </g>
                )}
              </svg>
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
