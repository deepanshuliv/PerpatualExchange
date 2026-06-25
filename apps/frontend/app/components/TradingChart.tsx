"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useTrading } from "../context/TradingContext";
import { Settings, Maximize2, Camera, Undo2, Redo2 } from "lucide-react";

interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export default function TradingChart() {
  const { market, lastPrice } = useTrading();
  const [activeTab, setActiveTab] = useState<"chart" | "depth" | "margin" | "funding" | "market_info">("chart");
  const [priceType, setPriceType] = useState<"last" | "mark" | "index">("last");
  const [interval, setInterval] = useState("1h");
  
  // Hover state
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [mouseCoords, setMouseCoords] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Map market to base price and asset name
  const marketDetails = useMemo(() => {
    if (market === "ETHUSD") {
      return { label: "ETH-PERP", basePrice: 3450, precision: 2 };
    }
    if (market === "SOLUSD") {
      return { label: "SOL-PERP", basePrice: 145, precision: 2 };
    }
    return { label: "BTC-PERP", basePrice: 61600, precision: 1 };
  }, [market]);

  // Generate historical dummy data based on market and interval
  const historicalData = useMemo(() => {
    const data: Candle[] = [];
    const count = 45;
    let currentPrice = marketDetails.basePrice;
    
    // Seeded random number generator for stability
    let seed = 7;
    const random = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    const now = new Date();
    
    for (let i = count - 1; i >= 0; i--) {
      const candleTime = new Date(now.getTime() - i * 60 * 60 * 1000);
      let timeLabel = "";
      if (interval === "15m") {
        const minTime = new Date(now.getTime() - i * 15 * 60 * 1000);
        timeLabel = minTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } else if (interval === "1h") {
        timeLabel = candleTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } else if (interval === "4h") {
        const hour4Time = new Date(now.getTime() - i * 4 * 60 * 60 * 1000);
        timeLabel = `${hour4Time.getDate()} Jun ${hour4Time.getHours()}:00`;
      } else {
        const dayTime = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        timeLabel = dayTime.toLocaleDateString([], { month: "short", day: "numeric" });
      }

      // Generate realistic price action
      const volatility = currentPrice * 0.006;
      const change = (random() - 0.48) * volatility;
      const open = currentPrice;
      const close = currentPrice + change;
      
      const highest = Math.max(open, close);
      const lowest = Math.min(open, close);
      const high = highest + random() * volatility * 0.4;
      const low = lowest - random() * volatility * 0.4;
      const volume = Math.floor(random() * 800 + 100);

      data.push({
        time: timeLabel,
        open,
        high,
        low,
        close,
        volume
      });
      currentPrice = close;
    }
    return data;
  }, [marketDetails.basePrice, interval]);

  // Merge the real live price from WebSocket as the last tick
  const chartData = useMemo(() => {
    if (historicalData.length === 0) return [];
    const copy = [...historicalData];
    const last = { ...copy[copy.length - 1] };
    
    // Inject lastPrice if available
    if (lastPrice > 0) {
      last.close = lastPrice;
      if (lastPrice > last.high) last.high = lastPrice;
      if (lastPrice < last.low) last.low = lastPrice;
    }
    copy[copy.length - 1] = last;
    return copy;
  }, [historicalData, lastPrice]);

  // Compute price ranges for scale
  const { minPrice, maxPrice, priceRange, scaleY, candleWidth, gap } = useMemo(() => {
    if (chartData.length === 0) {
      return { minPrice: 0, maxPrice: 0, priceRange: 0, scaleY: (p: number) => 0, candleWidth: 6, gap: 2 };
    }
    
    const highs = chartData.map((d) => d.high);
    const lows = chartData.map((d) => d.low);
    const maxVal = Math.max(...highs) * 1.002;
    const minVal = Math.min(...lows) * 0.998;
    const range = maxVal - minVal;

    // Viewport coordinates
    const chartHeight = 300; // SVG chart inner height
    const padding = 15;

    const scaleYFunc = (price: number) => {
      return chartHeight - padding - ((price - minVal) / range) * (chartHeight - 2 * padding);
    };

    return {
      minPrice: minVal,
      maxPrice: maxVal,
      priceRange: range,
      scaleY: scaleYFunc,
      candleWidth: 8,
      gap: 3
    };
  }, [chartData]);

  // Default active candle data when not hovering
  const activeCandle = hoveredCandle || chartData[chartData.length - 1];

  // Calculate percentage change of active candle
  const getActiveCandleChange = () => {
    if (!activeCandle) return { diff: "0.0", pct: "0.00", isGreen: true };
    const diff = activeCandle.close - activeCandle.open;
    const pct = (diff / activeCandle.open) * 100;
    const isGreen = diff >= 0;
    return {
      diff: (isGreen ? "+" : "") + diff.toFixed(marketDetails.precision),
      pct: (isGreen ? "+" : "") + pct.toFixed(2),
      isGreen
    };
  };

  const candleChange = getActiveCandleChange();

  // Mouse Move handlers to draw crosshairs
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!containerRef.current) return;
    const svgRect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - svgRect.left;
    const y = e.clientY - svgRect.top;

    setMouseCoords({ x, y });

    // Find closest candle based on X coordinate
    const chartWidth = svgRect.width - 55; // Leave room for right Y-axis
    const totalCandles = chartData.length;
    const step = chartWidth / totalCandles;
    
    const candleIndex = Math.min(
      Math.max(Math.floor(x / step), 0),
      totalCandles - 1
    );
    
    setHoveredCandle(chartData[candleIndex]);
  };

  const handleMouseLeave = () => {
    setHoveredCandle(null);
    setMouseCoords(null);
  };

  // Convert client coordinate Y back to price for Y-axis hover bubble
  const getHoverPrice = () => {
    if (!mouseCoords) return 0;
    // inverse of scaleY calculation
    const chartHeight = 300;
    const padding = 15;
    const relativeY = chartHeight - padding - mouseCoords.y;
    return minPrice + (relativeY / (chartHeight - 2 * padding)) * priceRange;
  };

  return (
    <div className="flex flex-col h-full bg-[#0c0d10] border border-[#171a1f] rounded-lg overflow-hidden select-none font-sans" ref={containerRef}>
      {/* Top Tab Bar Header */}
      <div className="flex items-center justify-between border-b border-[#171a1f] bg-[#0c0d10] px-3 h-10 shrink-0">
        <div className="flex space-x-1">
          {[
            { id: "chart", label: "Chart" },
            { id: "depth", label: "Depth" },
            { id: "margin", label: "Margin" },
            { id: "funding", label: "Funding" },
            { id: "market_info", label: "Market Info" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
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

        {/* Price Type Selector */}
        <div className="flex items-center bg-[#12161c] border border-[#171a1f] rounded p-0.5 space-x-0.5">
          {[
            { id: "last", label: "Last" },
            { id: "mark", label: "Mark" },
            { id: "index", label: "Index" }
          ].map((type) => (
            <button
              key={type.id}
              onClick={() => setPriceType(type.id as any)}
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
          {/* Sub Toolbar */}
          <div className="flex items-center justify-between px-3 h-9 bg-[#0c0d10] border-b border-[#171a1f] shrink-0 text-xs">
            {/* Left Toolbar Items */}
            <div className="flex items-center space-x-3">
              <div className="flex space-x-1">
                {["15m", "1h", "4h", "1d"].map((timeframe) => (
                  <button
                    key={timeframe}
                    onClick={() => setInterval(timeframe)}
                    className={`px-1.5 py-0.5 rounded font-semibold text-[11px] ${
                      interval === timeframe
                        ? "bg-[#171a1f] text-white"
                        : "text-[#8491a5] hover:text-white"
                    }`}
                  >
                    {timeframe}
                  </button>
                ))}
              </div>

              <div className="h-4 w-[1px] bg-[#171a1f]" />

              {/* Chart style buttons */}
              <button className="text-[#8491a5] hover:text-white p-0.5">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 3v18M19 3v18M9 6v12h6V6H9z" />
                </svg>
              </button>

              <button className="text-[#8491a5] hover:text-white p-0.5">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 18h18" />
                </svg>
              </button>

              <button className="text-[#8491a5] hover:text-white font-semibold text-[11px]">
                Indicators
              </button>
              
              <button className="text-blue-400 hover:text-blue-300 font-semibold text-[10px] bg-blue-500/10 px-1.5 py-0.5 rounded font-bold">
                OL
              </button>
              <button className="text-purple-400 hover:text-purple-300 font-semibold text-[10px] bg-purple-500/10 px-1.5 py-0.5 rounded font-bold">
                TE
              </button>

              <div className="flex space-x-1 text-[#8491a5]">
                <button className="hover:text-white p-0.5">
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button className="hover:text-white p-0.5">
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Right Toolbar Items */}
            <div className="flex items-center space-x-3 text-[#8491a5]">
              <button className="hover:text-white p-0.5">
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button className="hover:text-white p-0.5">
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button className="hover:text-white p-0.5">
                <Camera className="w-3.5 h-3.5" />
              </button>
              <button className="hover:text-white text-[11px] font-semibold">
                Reset
              </button>
            </div>
          </div>

          {/* Candle Details Header Row (matches screenshot) */}
          <div className="px-4 py-2 flex flex-wrap items-center text-[10px] select-none shrink-0 font-semibold text-zinc-500 gap-1.5 bg-[#08090b]">
            <span className="text-white font-bold text-[11px]">{marketDetails.label}</span>
            <span className="text-zinc-500 font-semibold">· {interval} · Backpack</span>
            <span className="w-1 h-1 rounded-full bg-[#00c087] ml-0.5" />
            
            {activeCandle && (
              <div className="flex items-center space-x-2 ml-2 font-mono text-[10px]">
                <span>
                  O<span className={candleChange.isGreen ? "text-[#00c087] font-bold" : "text-[#ff3b30] font-bold"}> {activeCandle.open.toFixed(marketDetails.precision)}</span>
                </span>
                <span>
                  H<span className={candleChange.isGreen ? "text-[#00c087] font-bold" : "text-[#ff3b30] font-bold"}> {activeCandle.high.toFixed(marketDetails.precision)}</span>
                </span>
                <span>
                  L<span className={candleChange.isGreen ? "text-[#00c087] font-bold" : "text-[#ff3b30] font-bold"}> {activeCandle.low.toFixed(marketDetails.precision)}</span>
                </span>
                <span>
                  C<span className={candleChange.isGreen ? "text-[#00c087] font-bold" : "text-[#ff3b30] font-bold"}> {activeCandle.close.toFixed(marketDetails.precision)}</span>
                </span>
                <span className={candleChange.isGreen ? "text-[#00c087] font-bold" : "text-[#ff3b30] font-bold"}>
                  {candleChange.diff} ({candleChange.pct}%)
                </span>
              </div>
            )}
          </div>

          {/* Custom SVG Chart Area */}
          <div className="flex-1 w-full bg-[#08090b] relative overflow-hidden flex flex-col justify-between">
            <svg
              className="w-full h-full cursor-crosshair overflow-hidden"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              {/* Grid Lines */}
              {Array.from({ length: 6 }).map((_, idx) => {
                const price = minPrice + (priceRange / 5) * idx;
                const y = scaleY(price);
                return (
                  <g key={`grid-line-${idx}`}>
                    <line
                      x1={0}
                      y1={y}
                      x2="100%"
                      y2={y}
                      stroke="#12161c"
                      strokeWidth={1}
                    />
                    {/* Right aligned price axis ticks */}
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

              {/* Vertical Grid Lines and X-Axis Ticks */}
              {chartData.map((d, idx) => {
                const totalCandles = chartData.length;
                const width = 100; // approximation
                const step = 90 / totalCandles;
                
                // Show X-axis text every 8 candles
                if (idx % 9 === 0 && idx < totalCandles - 1) {
                  const xPct = `${idx * step + 4}%`;
                  return (
                    <g key={`grid-col-${idx}`}>
                      <line
                        x1={xPct}
                        y1={0}
                        x2={xPct}
                        y2="85%"
                        stroke="#12161c"
                        strokeWidth={1}
                        strokeDasharray="2,2"
                      />
                      <text
                        x={xPct}
                        y="92%"
                        textAnchor="middle"
                        fill="#4b5563"
                        className="font-mono text-[9px] font-bold"
                      >
                        {d.time}
                      </text>
                    </g>
                  );
                }
                return null;
              })}

              {/* Volume bars in background (lower 20% of chart) */}
              {chartData.map((d, idx) => {
                const totalCandles = chartData.length;
                const step = 90 / totalCandles;
                const xPct = `${idx * step + 2}%`;
                
                const maxVol = Math.max(...chartData.map((c) => c.volume)) || 1;
                const barHeight = (d.volume / maxVol) * 45; // max 45px height
                const yPos = 240 - barHeight;
                const isGreen = d.close >= d.open;

                return (
                  <rect
                    key={`vol-${idx}`}
                    x={xPct}
                    y={yPos}
                    width="1.3%"
                    height={barHeight}
                    fill={isGreen ? "#00c087" : "#ff3b30"}
                    opacity={0.12}
                  />
                );
              })}

              {/* Candlesticks (Wicks and Bodies) */}
              {chartData.map((d, idx) => {
                const totalCandles = chartData.length;
                const step = 90 / totalCandles;
                const xPctNum = idx * step + 2.5;
                const xPct = `${xPctNum}%`;
                const wickXPct = `${xPctNum + 0.65}%`;
                
                const yOpen = scaleY(d.open);
                const yClose = scaleY(d.close);
                const yHigh = scaleY(d.high);
                const yLow = scaleY(d.low);

                const bodyHeight = Math.max(Math.abs(yClose - yOpen), 1.5);
                const bodyY = Math.min(yOpen, yClose);
                const isGreen = d.close >= d.open;

                return (
                  <g key={`candle-${idx}`}>
                    {/* Wick */}
                    <line
                      x1={wickXPct}
                      y1={yHigh}
                      x2={wickXPct}
                      y2={yLow}
                      stroke={isGreen ? "#00c087" : "#ff3b30"}
                      strokeWidth={1.2}
                    />
                    {/* Body */}
                    <rect
                      x={xPct}
                      y={bodyY}
                      width="1.3%"
                      height={bodyHeight}
                      fill={isGreen ? "#00c087" : "#ff3b30"}
                      stroke={isGreen ? "#00c087" : "#ff3b30"}
                      strokeWidth={0.5}
                      rx={0.5}
                    />
                  </g>
                );
              })}

              {/* Current Price line overlay */}
              {chartData.length > 0 && (
                <g>
                  <line
                    x1="0"
                    y1={scaleY(chartData[chartData.length - 1].close)}
                    x2="100%"
                    y2={scaleY(chartData[chartData.length - 1].close)}
                    stroke={lastPrice >= minPrice ? (lastPrice >= chartData[chartData.length - 2].close ? "#00c087" : "#ff3b30") : "#00c087"}
                    strokeWidth={1}
                    strokeDasharray="2,3"
                    opacity={0.7}
                  />
                  {/* Current Price Axis label */}
                  <rect
                    x="100%"
                    transform="translate(-52, -7)"
                    y={scaleY(chartData[chartData.length - 1].close)}
                    width="50"
                    height="14"
                    rx={2}
                    fill={lastPrice >= chartData[chartData.length - 2].close ? "#00c087" : "#ff3b30"}
                  />
                  <text
                    x="100%"
                    dx={-27}
                    y={scaleY(chartData[chartData.length - 1].close) + 3}
                    textAnchor="middle"
                    fill="#08090b"
                    className="font-mono text-[9px] font-bold"
                  >
                    {(lastPrice > 0 ? lastPrice : chartData[chartData.length - 1].close).toFixed(marketDetails.precision)}
                  </text>
                </g>
              )}

              {/* Active Hover Crosshairs & Labels */}
              {mouseCoords && (
                <g>
                  {/* Vertical crosshair line */}
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
                  {/* Horizontal crosshair line */}
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

                  {/* Y-axis hover value pill */}
                  {mouseCoords.x < svgRectWidth() - 55 && (
                    <g>
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

                  {/* X-axis hover value pill */}
                  {hoveredCandle && (
                    <g>
                      <rect
                        x={mouseCoords.x - 30}
                        y="86%"
                        width="60"
                        height="14"
                        rx={2}
                        fill="#1f2937"
                      />
                      <text
                        x={mouseCoords.x}
                        y="91%"
                        textAnchor="middle"
                        fill="#f3f4f6"
                        className="font-mono text-[8px] font-bold"
                      >
                        {hoveredCandle.time}
                      </text>
                    </g>
                  )}
                </g>
              )}
            </svg>

            {/* TradingView Bottom Left Floating Watermark Logo */}
            <div className="absolute bottom-11 left-4 opacity-15 pointer-events-none flex items-center space-x-1 select-none">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.29 13.29c-.39.39-1.02.39-1.41 0L8.7 12.1c-.39-.39-.39-1.02 0-1.41l3.18-3.18c.39-.39 1.02-.39 1.41 0s.39 1.02 0 1.41L10.82 11.4H17c.55 0 1 .45 1 1s-.45 1-1 1h-6.18l2.47 2.47c.39.39.39 1.02 0 1.42z" />
              </svg>
              <span className="text-[10px] font-bold text-white tracking-widest uppercase">TradingView</span>
            </div>

            {/* Bottom Volume SMA overlay indicator indicator text (bottom left inside graph) */}
            <div className="absolute bottom-11 left-4 font-mono text-[9px] text-[#00c087] opacity-65 flex items-center space-x-1 select-none">
              <span>Volume SMA 31.67</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-[#8491a5] font-sans">
          <span>{activeTab.replace("_", " ").toUpperCase()} layout content in development</span>
        </div>
      )}
    </div>
  );

  // Helper function to approximate container SVG width for calculations
  function svgRectWidth() {
    if (typeof window !== "undefined" && containerRef.current) {
      return containerRef.current.clientWidth;
    }
    return 600;
  }
}
