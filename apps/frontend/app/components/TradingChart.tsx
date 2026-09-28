"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useTrading, type ChartCandle, type ChartInterval } from "../context/TradingContext";
import {
  formatFundingRate,
  fundingRateColorClass,
  FUNDING_INTERVAL_MS,
} from "../utils/funding";
import CandlestickChart from "./CandlestickChart";
import { EmptyState, Panel, PanelTabs, Segmented } from "./ui";

type ChartTab = "chart" | "depth" | "margin" | "funding" | "market_info";

const CHART_TABS: { id: ChartTab; label: string }[] = [
  { id: "chart", label: "Chart" },
  { id: "depth", label: "Depth" },
  { id: "margin", label: "Margin" },
  { id: "funding", label: "Funding" },
  { id: "market_info", label: "Contract" },
];

const INTERVALS: ChartInterval[] = ["1m", "5m", "15m", "1h", "1d"];

function Row({ label, value, valueClass = "text-fg" }: { label: string; value: ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-[13px]">
      <span className="text-muted">{label}</span>
      <span className={`font-mono text-xs ${valueClass}`}>{value}</span>
    </div>
  );
}

function Metric({ label, value, hint, valueClass = "text-fg" }: { label: string; value: ReactNode; hint?: string; valueClass?: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-raised p-3.5">
      <span className="text-xs text-muted">{label}</span>
      <span className={`font-mono text-xl font-medium tracking-tight ${valueClass}`}>{value}</span>
      {hint && <span className="text-xs text-subtle">{hint}</span>}
    </div>
  );
}

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
  const [activeTab, setActiveTab] = useState<ChartTab>("chart");
  const [priceType, setPriceType] = useState<"last" | "mark">("last");
  const [hoveredCandle, setHoveredCandle] = useState<ChartCandle | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const marketDetails = useMemo(() => {
    const leverage = market === "ETHUSD" ? 50 : market === "SOLUSD" ? 20 : 75;
    return {
      label: market === "ETHUSD" ? "ETH-PERP" : market === "SOLUSD" ? "SOL-PERP" : "BTC-PERP",
      maxLeverage: `${leverage}x`,
      // Enforced by the API: margin must be at least notional / max leverage.
      minInitialMargin: `${(100 / leverage).toFixed(2)}%`,
      precision: market === "BTCUSD" ? 1 : 2,
    };
  }, [market]);

  const activePrice =
    priceType === "mark" && markPrice > 0
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

  const depthData = useMemo(() => {
    const sortedBids = [...bids].sort((a, b) => b.price - a.price).slice(0, 15);
    const sortedAsks = [...asks].sort((a, b) => a.price - b.price).slice(0, 15);

    const cumulative = (rows: { price: number; size: number }[]) =>
      rows.reduce<{ price: number; total: number }[]>((points, row) => {
        const prev = points.length ? points[points.length - 1]!.total : 0;
        points.push({ price: row.price, total: prev + row.size });
        return points;
      }, []);

    const bidPoints = cumulative(sortedBids);
    const askPoints = cumulative(sortedAsks);
    const cumBid = bidPoints.at(-1)?.total ?? 0;
    const cumAsk = askPoints.at(-1)?.total ?? 0;

    const maxDepth = Math.max(cumBid, cumAsk, 0.1);
    return { bidPoints, askPoints, maxDepth, cumBid, cumAsk };
  }, [bids, asks]);

  if (!mounted) {
    return <Panel className="min-h-[360px]"><div /></Panel>;
  }

  const fmt = (n: number) => n.toFixed(marketDetails.precision);

  return (
    <Panel>
      <PanelTabs
        tabs={CHART_TABS}
        active={activeTab}
        onChange={setActiveTab}
        right={
          activeTab === "chart" && (
            <>
              <Segmented
                options={INTERVALS.map((i) => ({ id: i, label: i }))}
                value={chartInterval}
                onChange={setChartInterval}
              />
              <div className="hidden xl:block">
                <Segmented
                  options={[
                    { id: "last", label: "Last" },
                    { id: "mark", label: "Mark" },
                  ]}
                  value={priceType}
                  onChange={setPriceType}
                />
              </div>
            </>
          )
        }
      />

      {activeTab === "chart" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[11px]">
            <span className="flex items-center gap-1.5 text-muted">
              <span
                className={`h-1.5 w-1.5 rounded-full ${wsReady ? "bg-up" : "bg-warn"}`}
                title={wsReady ? "Live" : "Connecting"}
              />
              <span className="font-medium text-fg">{marketDetails.label}</span>
              <span>· {chartInterval}</span>
            </span>
            {displayCandle && (
              <span className="flex flex-wrap gap-x-2.5 font-mono text-subtle">
                <span>
                  O <span className="text-muted">{fmt(displayCandle.open)}</span>
                </span>
                <span>
                  H <span className="text-muted">{fmt(displayCandle.high)}</span>
                </span>
                <span>
                  L <span className="text-muted">{fmt(displayCandle.low)}</span>
                </span>
                <span>
                  C{" "}
                  <span className={displayCandle.close >= displayCandle.open ? "text-up" : "text-down"}>
                    {fmt(displayCandle.close)}
                  </span>
                </span>
                <span>{formatCandleTime(displayCandle.openTime, chartInterval)}</span>
              </span>
            )}
          </div>

          <div className="relative min-h-[280px] w-full flex-1">
            {loadingCandles && candles.length === 0 ? (
              <EmptyState title={wsReady ? "Loading candle history…" : "Connecting to market data…"} />
            ) : candles.length === 0 ? (
              <EmptyState title="No candles yet" hint="Candles appear once the first trades print." />
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
        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium text-fg">Book depth</h3>
              <p className="text-xs text-muted">Cumulative resting size by price level</p>
            </div>
            <div className="flex items-center gap-4 font-mono text-xs">
              <span className="text-up">Bids {depthData.cumBid.toFixed(3)}</span>
              <span className="text-down">Asks {depthData.cumAsk.toFixed(3)}</span>
            </div>
          </div>

          <div className="grid min-h-[220px] flex-1 grid-cols-2 gap-px overflow-hidden rounded-md bg-line">
            {(["bid", "ask"] as const).map((side) => {
              const points = side === "bid" ? depthData.bidPoints : depthData.askPoints;
              const isBid = side === "bid";
              return (
                <div key={side} className="flex flex-col bg-surface p-3">
                  <div className="mb-2 flex justify-between text-[11px] text-subtle">
                    <span>{isBid ? "Bid price" : "Ask price"}</span>
                    <span>Cumulative</span>
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5">
                    {points.length === 0 ? (
                      <EmptyState title={isBid ? "No bids" : "No asks"} />
                    ) : (
                      points.slice(0, 8).map((point, idx) => {
                        const widthPct = Math.min((point.total / depthData.maxDepth) * 100, 100);
                        return (
                          <div
                            key={`${side}-depth-${idx}`}
                            className="relative flex items-center justify-between px-1.5 py-1 font-mono text-xs"
                          >
                            <div
                              className={`absolute inset-y-0 ${isBid ? "right-0 bg-up/10" : "left-0 bg-down/10"} rounded-[3px]`}
                              style={{ width: `${widthPct}%` }}
                            />
                            <span className={`relative ${isBid ? "text-up" : "text-down"}`}>
                              {point.price.toLocaleString()}
                            </span>
                            <span className="relative text-muted">{point.total.toFixed(4)}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : activeTab === "margin" ? (
        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Metric label="Max leverage" value={marketDetails.maxLeverage} hint="Choose 1x up to the max per order" />
            <Metric label="Min. initial margin" value={marketDetails.minInitialMargin} hint="Of position value, at max leverage" />
            <Metric label="Liquidation at" value="95%" hint="Of position margin lost" />
          </div>

          <div>
            <h3 className="mb-1 text-sm font-medium text-fg">Liquidation rules</h3>
            <div className="grid grid-cols-1 gap-x-8 divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
              <div className="divide-y divide-line">
                <Row label="Margin mode" value="Isolated per position" />
                <Row label="Checked on" value="Every mark-price update" />
                <Row label="Liquidation fee" value="None" />
              </div>
              <div className="divide-y divide-line">
                <Row label="Closed by" value="Market order into the book" />
                <Row label="Unfilled remainder" value="Auto-deleveraged at mark" />
                <Row label="ADL priority" value="Highest unrealized PnL" />
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === "funding" ? (
        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Metric
              label="Estimated funding rate"
              value={displayFundingRate !== null ? formatFundingRate(displayFundingRate) : "—"}
              valueClass={displayFundingRate !== null ? fundingRateColorClass(displayFundingRate) : "text-muted"}
              hint={fundingDirection}
            />
            <Metric
              label="Next funding in"
              value={fundingCountdown}
              hint={`Settles every ${FUNDING_INTERVAL_MS / (60 * 60 * 1000)} hours`}
            />
          </div>

          <div>
            <h3 className="mb-1 text-sm font-medium text-fg">Rate inputs</h3>
            <div className="divide-y divide-line">
              <Row label="Mark price (external oracle)" value={markPrice > 0 ? fmt(markPrice) : "—"} />
              <Row label="Last traded price" value={lastPrice > 0 ? fmt(lastPrice) : "—"} />
            </div>
            <p className="mt-3 max-w-prose text-xs leading-relaxed text-subtle">
              Rate = clamp((Last − Mark) / Mark, −0.05%, +0.05%). When the contract trades at a premium,
              longs pay shorts; at a discount, shorts pay longs.
            </p>
          </div>
        </div>
      ) : (
        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <h3 className="text-sm font-medium text-fg">{marketDetails.label} contract specifications</h3>
          <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            <div className="divide-y divide-line">
              <Row label="Contract type" value="Linear perpetual" />
              <Row label="Settlement asset" value="USD" />
              <Row label="Order types" value="Limit, Market" />
              <Row label="Trading fees" value="None" />
            </div>
            <div className="divide-y divide-line">
              <Row label="Mark price" value="Binance Futures (1s)" />
              <Row label="Funding interval" value="8 hours" />
              <Row label="Max leverage" value={marketDetails.maxLeverage} />
              <Row label="Trading hours" value="24/7" />
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
