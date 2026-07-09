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
    color: c.close >= c.open ? "rgba(0, 192, 135, 0.45)" : "rgba(246, 70, 93, 0.45)",
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

  candlesRef.current = candles;
  onHoverRef.current = onHoverCandle;

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
        background: { type: ColorType.Solid, color: "#08090b" },
        textColor: "#8491a5",
        fontSize: 11,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      },
      grid: {
        vertLines: { color: "#12161c" },
        horzLines: { color: "#12161c" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "#5d6b7e",
          width: 1,
          style: LineStyle.LargeDashed,
          labelBackgroundColor: "#12161c",
        },
        horzLine: {
          color: "#5d6b7e",
          width: 1,
          style: LineStyle.LargeDashed,
          labelBackgroundColor: "#12161c",
        },
      },
      rightPriceScale: {
        borderColor: "#171a1f",
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderColor: "#171a1f",
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
      upColor: "#00c087",
      downColor: "#f6465d",
      borderVisible: false,
      wickUpColor: "#00c087",
      wickDownColor: "#f6465d",
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
        color: "#00c087",
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
