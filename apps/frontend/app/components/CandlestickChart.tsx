"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { ChartCandle, ChartInterval } from "../context/TradingContext";

interface CandlestickChartProps {
  candles: ChartCandle[];
  chartInterval: ChartInterval;
  marketLabel: string;
  activePrice: number;
  onHoverCandle?: (candle: ChartCandle | null) => void;
}

function toTime(openTimeMs: number): UTCTimestamp {
  return Math.floor(openTimeMs / 1000) as UTCTimestamp;
}

function toCandleData(candles: ChartCandle[]): CandlestickData[] {
  return candles.map((c) => ({
    time: toTime(c.openTime),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
}

function toVolumeData(candles: ChartCandle[]): HistogramData[] {
  return candles.map((c) => ({
    time: toTime(c.openTime),
    value: c.volume,
    color: c.close >= c.open ? "rgba(46, 189, 133, 0.35)" : "rgba(239, 95, 107, 0.35)",
  }));
}

export default function CandlestickChart({
  candles,
  chartInterval,
  marketLabel,
  activePrice,
  onHoverCandle,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const priceLineRef = useRef<ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]> | null>(
    null,
  );
  const candlesRef = useRef(candles);
  const onHoverRef = useRef(onHoverCandle);
  const shouldFitRef = useRef(true);

  // Keep the latest values available to chart callbacks without re-creating the chart.
  useEffect(() => {
    candlesRef.current = candles;
    onHoverRef.current = onHoverCandle;
  }, [candles, onHoverCandle]);

  useEffect(() => {
    shouldFitRef.current = true;
  }, [marketLabel, chartInterval]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "#0f0f0f" },
        textColor: "#5e5e5e",
        fontSize: 11,
        fontFamily: `${getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono")}, ui-monospace, monospace`,
      },
      grid: {
        vertLines: { color: "#171717" },
        horzLines: { color: "#171717" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "#3a3a3a",
          width: 1,
          style: LineStyle.LargeDashed,
          labelBackgroundColor: "#2b2b2b",
        },
        horzLine: {
          color: "#3a3a3a",
          width: 1,
          style: LineStyle.LargeDashed,
          labelBackgroundColor: "#2b2b2b",
        },
      },
      rightPriceScale: {
        borderColor: "#1c1c1c",
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderColor: "#1c1c1c",
        timeVisible: true,
        secondsVisible: chartInterval === "1h",
        rightOffset: 6,
        barSpacing: 10,
        minBarSpacing: 3,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#2ebd85",
      downColor: "#ef5f6b",
      borderVisible: false,
      wickUpColor: "#2ebd85",
      wickDownColor: "#ef5f6b",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const canvas = container.querySelector("canvas");
    if (canvas) {
      canvas.setAttribute(
        "aria-label",
        `Chart for ${marketLabel.replace("-", "_")}, ${chartInterval === "1d" ? "1 day" : "1 hour"}`,
      );
    }

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      chart.applyOptions({
        width: Math.floor(entry.contentRect.width),
        height: Math.floor(entry.contentRect.height),
      });
    });
    ro.observe(container);

    chart.subscribeCrosshairMove((param) => {
      const onHover = onHoverRef.current;
      if (!onHover) return;
      if (param.time === undefined) {
        onHover(null);
        return;
      }
      const match = candlesRef.current.find((c) => toTime(c.openTime) === param.time);
      onHover(match ?? null);
    });

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLineRef.current = null;
    };
  }, [marketLabel, chartInterval]);

  useEffect(() => {
    chartRef.current?.timeScale().applyOptions({
      secondsVisible: chartInterval === "1h",
    });
  }, [chartInterval]);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const chart = chartRef.current;
    if (!candleSeries || !volumeSeries || !chart) return;

    if (candles.length === 0) {
      candleSeries.setData([]);
      volumeSeries.setData([]);
      return;
    }

    candleSeries.setData(toCandleData(candles));
    volumeSeries.setData(toVolumeData(candles));

    if (shouldFitRef.current) {
      chart.timeScale().fitContent();
      shouldFitRef.current = false;
    }
  }, [candles]);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries) return;

    if (priceLineRef.current) {
      candleSeries.removePriceLine(priceLineRef.current);
      priceLineRef.current = null;
    }

    if (activePrice > 0) {
      priceLineRef.current = candleSeries.createPriceLine({
        price: activePrice,
        color: "#8f8f8f",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
      });
    }
  }, [activePrice]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full"
      style={{ touchAction: "none" }}
    />
  );
}
