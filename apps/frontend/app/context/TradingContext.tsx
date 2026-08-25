'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { Fill, Order, OrderBookRow, Position } from 'types';
import { useApi, WS_BASE } from '../hooks/useApi';
import {
  computeFundingRatePreview,
  formatCountdown,
  fundingMsRemaining,
  startFundingTimer,
} from '../utils/funding';
import { parseDepthSnapshot } from '../utils/orderbook';
import { calculateUnrealizedPnl } from '../utils/position';

export interface MarketTrade {
  price: number;
  qty: number;
  time: number;
}

export interface MarketLiquidation {
  userId: string;
  kind: 'LONG' | 'SHORT';
  price: number;
  qty: number;
  totalQty: number;
  time: number;
}

export interface ChartCandle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type ChartInterval = '1m' | '5m' | '15m' | '1h' | '1d';

interface TradingContextType {
  market: 'BTCUSD' | 'ETHUSD' | 'SOLUSD';
  setMarket: (market: 'BTCUSD' | 'ETHUSD' | 'SOLUSD') => void;
  chartInterval: ChartInterval;
  setChartInterval: (interval: ChartInterval) => void;
  candles: ChartCandle[];
  loadingCandles: boolean;
  wsReady: boolean;
  token: string | null;
  user: { id: string; username: string } | null;
  balance: number;
  bids: OrderBookRow[];
  asks: OrderBookRow[];
  lastPrice: number;
  markPrice: number;
  previewFundingRate: number | null;
  fundingCountdown: string;
  marketTrades: MarketTrade[];
  marketLiquidations: MarketLiquidation[];
  openPositions: Position[];
  openOrders: Order[];
  fills: Fill[];
  loadingDepth: boolean;
  authModalMode: 'login' | 'signup' | null;
  setAuthModalMode: (mode: 'login' | 'signup' | null) => void;
  login: (username: string, password?: string) => Promise<boolean>;
  signup: (username: string, password?: string) => Promise<boolean>;
  logout: () => void;
  deposit: (amount: number) => Promise<{ ok: boolean; msg?: string }>;
  placeOrder: (
    qty: string,
    price: number,
    type: 'LIMIT' | 'MARKET',
    kind: 'LONG' | 'SHORT',
    margin: number,
  ) => Promise<any>;
  cancelOrder: (orderId: string) => Promise<boolean>;
  refreshUserData: () => void;
}

const TradingContext = createContext<TradingContextType | undefined>(undefined);

export const useTrading = () => {
  const context = useContext(TradingContext);
  if (!context) {
    throw new Error('useTrading must be used within a TradingProvider');
  }
  return context;
};

const MAX_MARKET_TRADES = 100;
const MAX_MARKET_LIQUIDATIONS = 100;

function tradeKey(trade: MarketTrade) {
  return `${trade.time}-${trade.price}-${trade.qty}`;
}

function liquidationKey(liq: MarketLiquidation) {
  return `${liq.time}-${liq.userId}-${liq.price}-${liq.qty}`;
}

function mergeMarketTrades(prev: MarketTrade[], incoming: MarketTrade[]) {
  const seen = new Set(prev.map(tradeKey));
  const merged = [...prev];
  for (const trade of incoming) {
    const key = tradeKey(trade);
    if (seen.has(key)) continue;
    merged.push(trade);
    seen.add(key);
  }
  return merged.sort((a, b) => b.time - a.time).slice(0, MAX_MARKET_TRADES);
}

function mergeMarketLiquidations(prev: MarketLiquidation[], incoming: MarketLiquidation[]) {
  const seen = new Set(prev.map(liquidationKey));
  const merged = [...prev];
  for (const liq of incoming) {
    const key = liquidationKey(liq);
    if (seen.has(key)) continue;
    merged.push(liq);
    seen.add(key);
  }
  return merged.sort((a, b) => b.time - a.time).slice(0, MAX_MARKET_LIQUIDATIONS);
}

const INTERVAL_MS: Record<ChartInterval, number> = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

function midPriceFromOrderbook(bids: OrderBookRow[], asks: OrderBookRow[]): number | null {
  const bestBid = bids.length > 0 ? Math.max(...bids.map((b) => b.price)) : null;
  const bestAsk = asks.length > 0 ? Math.min(...asks.map((a) => a.price)) : null;
  if (bestBid && bestAsk && bestBid > 0 && bestAsk > 0) return (bestBid + bestAsk) / 2;
  if (bestBid && bestBid > 0) return bestBid;
  if (bestAsk && bestAsk > 0) return bestAsk;
  return null;
}

function formatWsCandle(item: {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}): ChartCandle {
  return {
    openTime: Number(item.openTime),
    open: Number(item.open),
    high: Number(item.high),
    low: Number(item.low),
    close: Number(item.close),
    volume: Number(item.volume),
  };
}

function mergeCandleUpdate(prev: ChartCandle[], candle: ChartCandle): ChartCandle[] {
  if (prev.length === 0) return [candle];
  const last = prev[prev.length - 1]!;
  if (last.openTime === candle.openTime) {
    return [...prev.slice(0, -1), candle];
  }
  if (last.openTime < candle.openTime) {
    return [...prev, candle];
  }
  return prev;
}

function mergePriceIntoCandles(
  prev: ChartCandle[],
  price: number,
  interval: ChartInterval,
  volume = 0,
): ChartCandle[] {
  const intervalMs = INTERVAL_MS[interval];
  const openTime = Math.floor(Date.now() / intervalMs) * intervalMs;
  const nextCandle: ChartCandle = {
    openTime,
    open: price,
    high: price,
    low: price,
    close: price,
    volume,
  };

  if (prev.length === 0) return [nextCandle];

  const last = prev[prev.length - 1]!;
  if (last.openTime === openTime) {
    return [
      ...prev.slice(0, -1),
      {
        openTime,
        open: last.open,
        high: Math.max(last.high, price),
        low: Math.min(last.low, price),
        close: price,
        volume: last.volume + volume,
      },
    ];
  }
  if (last.openTime < openTime) return [...prev, nextCandle];
  return prev;
}

export const TradingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const api = useApi();
  const [market, setMarket] = useState<'BTCUSD' | 'ETHUSD' | 'SOLUSD'>('BTCUSD');
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; username: string } | null>(null);
  const [balance, setBalance] = useState<number>(0);

  const [bids, setBids] = useState<OrderBookRow[]>([]);
  const [asks, setAsks] = useState<OrderBookRow[]>([]);
  const [lastPrice, setLastPrice] = useState<number>(0);
  const [markPrice, setMarkPrice] = useState<number>(0);
  const [fundingDeadline, setFundingDeadline] = useState(() => startFundingTimer());
  const [fundingCountdown, setFundingCountdown] = useState('08:00:00');
  const [marketTrades, setMarketTrades] = useState<MarketTrade[]>([]);
  const [marketLiquidations, setMarketLiquidations] = useState<MarketLiquidation[]>([]);
  const [loadingDepth, setLoadingDepth] = useState<boolean>(true);
  const [chartInterval, setChartInterval] = useState<ChartInterval>('1m');
  const [candles, setCandles] = useState<ChartCandle[]>([]);
  const [loadingCandles, setLoadingCandles] = useState<boolean>(true);

  const previewFundingRate = computeFundingRatePreview(markPrice, lastPrice);

  const [basePositions, setBasePositions] = useState<Position[]>([]);
  const [markPricesByMarket, setMarkPricesByMarket] = useState<Record<string, number>>({});
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [fills, setFills] = useState<Fill[]>([]);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup' | null>(null);

  const openPositionsWithPnl = useMemo(
    () =>
      basePositions.map((pos) => ({
        ...pos,
        pnl: calculateUnrealizedPnl(
          pos.qty,
          pos.entryPrice,
          markPricesByMarket[pos.market] ?? 0,
        ),
      })),
    [basePositions, markPricesByMarket],
  );

  const wsRef = useRef<WebSocket | null>(null);
  const tokenRef = useRef<string | null>(token);
  const marketRef = useRef(market);
  const chartIntervalRef = useRef(chartInterval);
  const [wsReady, setWsReady] = useState(false);
  const [wsReconnectNonce, setWsReconnectNonce] = useState(0);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    marketRef.current = market;
  }, [market]);

  useEffect(() => {
    chartIntervalRef.current = chartInterval;
  }, [chartInterval]);

  useEffect(() => {
    const tick = () => setFundingCountdown(formatCountdown(fundingMsRemaining(fundingDeadline)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [fundingDeadline]);

  useEffect(() => {
    const savedToken = localStorage.getItem('perp_token');
    const savedUser = localStorage.getItem('perp_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      void refreshUserData(savedToken);
    }
  }, []);

  useEffect(() => {
    setBids([]);
    setAsks([]);
    setLoadingDepth(true);
    setLastPrice(0);
    setMarkPrice(0);
    setMarketTrades([]);
    setMarketLiquidations([]);
    setCandles([]);
    setLoadingCandles(true);
    setFundingDeadline(startFundingTimer());
  }, [market]);

  useEffect(() => {
    setCandles([]);
    setLoadingCandles(true);
  }, [chartInterval]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      refreshUserData();
    }, 3000);
    return () => clearInterval(interval);
  }, [market, token]);

  useEffect(() => {
    let closedByCleanup = false;
    const ws = new WebSocket(WS_BASE);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsReady(true);
      if (tokenRef.current) {
        refreshUserData();
      }
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (!payload.data || !payload.stream) return;

        const { stream, data } = payload;
        const streamMarket = stream.split('.')[1];
        if (streamMarket !== marketRef.current) return;

        if (stream.startsWith('depth')) {
          const { bids: rawBids, asks: rawAsks } = parseDepthSnapshot(data.bids, data.asks);
          setBids(rawBids);
          setAsks(rawAsks);
          setLoadingDepth(false);
          return;
        }

        if (stream.startsWith('trade')) {
          const trade: MarketTrade = {
            price: Number(data.price),
            qty: Number(data.qty),
            time: Number(data.transactionTime ?? data.executionTime ?? Date.now()),
          };
          if (trade.price > 0 && trade.qty > 0) {
            setMarketTrades((prev) => [trade, ...prev].slice(0, MAX_MARKET_TRADES));
          }
          return;
        }

        if (stream.startsWith('lastTradedPrice')) {
          const price = Number(data.price);
          if (price > 0) {
            setLastPrice(price);
          }
          return;
        }

        if (stream.startsWith('markPrice')) {
          const price = Number(data.price);
          if (price > 0) {
            setMarkPrice(price);
            setMarkPricesByMarket((prev) => ({ ...prev, [streamMarket]: price }));
          }
          return;
        }

        if (stream.startsWith('funding')) {
          setFundingDeadline(startFundingTimer());
          if (tokenRef.current) refreshUserData();
          return;
        }

        if (stream.startsWith('liquidation')) {
          const liquidation: MarketLiquidation = {
            userId: String(data.userId),
            kind: data.kind as 'LONG' | 'SHORT',
            price: Number(data.price),
            qty: Number(data.qty),
            totalQty: Number(data.totalQty),
            time: Number(data.transactionTime ?? data.executionTime ?? Date.now()),
          };
          if (liquidation.qty > 0) {
            setMarketLiquidations((prev) =>
              [liquidation, ...prev].slice(0, MAX_MARKET_LIQUIDATIONS),
            );
          }
          return;
        }

        if (stream.startsWith('candle.')) {
          const interval = stream.split('.')[2];
          if (interval !== chartIntervalRef.current) return;

          if (data.type === 'candle_snapshot' && Array.isArray(data.candles)) {
            const formatted: ChartCandle[] = data.candles
              .map((item: ChartCandle) => formatWsCandle(item))
              .filter((c: ChartCandle) => Number.isFinite(c.openTime) && c.open > 0);
            if (formatted.length > 0) {
              setCandles(formatted);
              setLoadingCandles(false);
            }
            return;
          }

          const candle = formatWsCandle(data as ChartCandle);
          if (!Number.isFinite(candle.openTime) || candle.open <= 0) return;

          setCandles((prev) => mergeCandleUpdate(prev, candle));
          setLoadingCandles(false);
          return;
        }
      } catch (err) {
        console.log('[wsOnMessage] error', err);
      }
    };

    ws.onerror = () => {
      if (!closedByCleanup) {
        console.log('[wsOnError] error', WS_BASE);
      }
    };

    ws.onclose = (event) => {
      setWsReady(false);
      if (closedByCleanup) return;
      console.log(`WebSocket closed (code ${event.code}), reconnecting in 3 seconds...`);
      setTimeout(() => {
        setWsReconnectNonce((n) => n + 1);
      }, 3000);
    };

    return () => {
      closedByCleanup = true;
      const activeWs = wsRef.current;
      if (activeWs?.readyState === WebSocket.OPEN) {
        unsubscribeFromMarket(activeWs, marketRef.current);
      }
      ws.close();
      wsRef.current = null;
    };
  }, [wsReconnectNonce]);

  useEffect(() => {
    const ws = wsRef.current;
    if (!wsReady || !ws || ws.readyState !== WebSocket.OPEN) return;

    subscribeToMarket(ws, market);
    subscribeToCandleInterval(ws, market, chartInterval);

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        unsubscribeFromMarket(ws, market);
        unsubscribeFromCandleInterval(ws, market, chartInterval);
      }
    };
  }, [market, chartInterval, wsReady]);

  const subscribeToMarket = (ws: WebSocket, targetMarket: string) => {
    const streams = [
      `depth.${targetMarket}`,
      `markPrice.${targetMarket}`,
      `lastTradedPrice.${targetMarket}`,
      `trade.${targetMarket}`,
      `funding.${targetMarket}`,
      `liquidation.${targetMarket}`,
    ];
    ws.send(JSON.stringify({ method: 'SUBSCRIBE', params: streams, id: 1 }));
  };

  const subscribeToCandleInterval = (
    ws: WebSocket,
    targetMarket: string,
    interval: ChartInterval,
  ) => {
    ws.send(
      JSON.stringify({
        method: 'SUBSCRIBE',
        params: [`candle.${targetMarket}.${interval}`],
        id: 3,
      }),
    );
  };

  const unsubscribeFromMarket = (ws: WebSocket, targetMarket: string) => {
    const streams = [
      `depth.${targetMarket}`,
      `markPrice.${targetMarket}`,
      `lastTradedPrice.${targetMarket}`,
      `trade.${targetMarket}`,
      `funding.${targetMarket}`,
      `liquidation.${targetMarket}`,
    ];
    ws.send(JSON.stringify({ method: 'UNSUBSCRIBE', params: streams, id: 2 }));
  };

  const unsubscribeFromCandleInterval = (
    ws: WebSocket,
    targetMarket: string,
    interval: ChartInterval,
  ) => {
    ws.send(
      JSON.stringify({
        method: 'UNSUBSCRIBE',
        params: [`candle.${targetMarket}.${interval}`],
        id: 4,
      }),
    );
  };

  const applyDepthFromApi = (rawBids: unknown, rawAsks: unknown) => {
    const { bids: bidsList, asks: asksList } = parseDepthSnapshot(rawBids, rawAsks);
    setBids(bidsList);
    setAsks(asksList);
    setLoadingDepth(false);

    const midPrice = midPriceFromOrderbook(bidsList, asksList);
    if (midPrice) {
      setCandles((prev) => {
        if (prev.length > 0) return prev;
        return mergePriceIntoCandles(prev, midPrice, chartIntervalRef.current);
      });
      setLoadingCandles(false);
    }
  };

  const fetchDepth = async () => {
    try {
      const json = await api.getDepth(market);
      if (json.ok && json.data) {
        applyDepthFromApi(json.data.bids, json.data.asks);
      }
    } catch (err) {
      console.log('[fetchDepth] error', err);
    } finally {
      setLoadingDepth(false);
    }
  };

  const fetchLastPrice = async () => {
    try {
      const json = await api.getTickerPrice(market);
      if (json.ok && json.price && Number(json.price) > 0) {
        const price = Number(json.price);
        setLastPrice(price);
        setCandles((prev) => {
          if (prev.length > 0) return prev;
          return mergePriceIntoCandles(prev, price, chartIntervalRef.current);
        });
        setLoadingCandles(false);
      }
    } catch (err) {
      console.log('[fetchLastPrice] error', err);
    }
  };

  const fetchTrades = async () => {
    try {
      const json = await api.getTrades(market);
      if (json.ok && Array.isArray(json.data)) {
        const formatted: MarketTrade[] = json.data.map(
          (item: { price: number; qty: number; time: number }) => ({
            price: Number(item.price),
            qty: Number(item.qty),
            time: Number(item.time),
          }),
        );
        setMarketTrades((prev) => mergeMarketTrades(prev, formatted));
      }
    } catch (err) {
      console.log('[fetchTrades] error', err);
    }
  };

  const fetchLiquidations = async () => {
    try {
      const json = await api.getLiquidations(market);
      if (json.ok && Array.isArray(json.data)) {
        const formatted: MarketLiquidation[] = json.data.map(
          (item: {
            userId: string;
            kind: 'LONG' | 'SHORT';
            price: number;
            qty: number;
            totalQty: number;
            time: number;
          }) => ({
            userId: item.userId,
            kind: item.kind,
            price: Number(item.price),
            qty: Number(item.qty),
            totalQty: Number(item.totalQty),
            time: Number(item.time),
          }),
        );
        setMarketLiquidations((prev) => mergeMarketLiquidations(prev, formatted));
      }
    } catch (err) {
      console.log('[fetchLiquidations] error', err);
    }
  };

  const fetchCandles = async () => {
    try {
      const json = await api.getCandles(market, chartInterval);
      if (json.ok && Array.isArray(json.data)) {
        const formatted: ChartCandle[] = json.data.map(
          (item: {
            openTime: number;
            open: number;
            high: number;
            low: number;
            close: number;
            volume: number;
          }) => ({
            openTime: Number(item.openTime),
            open: Number(item.open),
            high: Number(item.high),
            low: Number(item.low),
            close: Number(item.close),
            volume: Number(item.volume),
          }),
        );

        setCandles((prev) => {
          if (formatted.length === 0) return prev;
          if (prev.length === 0) return formatted;

          const lastHttp = formatted[formatted.length - 1]!;
          const lastLive = prev[prev.length - 1]!;
          if (lastLive.openTime >= lastHttp.openTime) {
            const older = formatted.filter((c) => c.openTime < lastLive.openTime);
            return [...older, lastLive];
          }
          return formatted;
        });
      }
    } catch (err) {
      console.log('[fetchCandles] error', err);
    } finally {
      setLoadingCandles(false);
    }
  };

  const fetchMarkPrice = async () => {
    try {
      const json = await api.getMarkPrice(market);
      const price = Number(json?.price);
      if (price > 0) {
        setMarkPrice(price);
        setMarkPricesByMarket((prev) => ({ ...prev, [market]: price }));
      }
    } catch (err) {
      console.log('[fetchMarkPrice] error', err);
    }
  };

  const fetchMarkPricesForMarkets = async (markets: string[]) => {
    const unique = [...new Set(markets)].filter(Boolean);
    if (unique.length === 0) return;

    const updates: Record<string, number> = {};
    await Promise.all(
      unique.map(async (m) => {
        try {
          const json = await api.getMarkPrice(m);
          const price = Number(json?.price ?? json?.data?.price);
          if (price > 0) updates[m] = price;
        } catch (err) {
          console.log('[fetchMarkPricesForMarkets] error', err);
        }
      }),
    );

    if (Object.keys(updates).length > 0) {
      setMarkPricesByMarket((prev) => ({ ...prev, ...updates }));
    }
  };
  useEffect(() => {
    fetchDepth();
    fetchLastPrice();
    fetchMarkPrice();
    fetchTrades();
    fetchLiquidations();
    fetchCandles();
  }, [market, chartInterval]);

  const refreshUserData = async (authToken?: string) => {
    const activeToken = authToken ?? token;
    if (!activeToken) return;

    try {
      const balanceJson = await api.getAvailableEquity(activeToken);
      if (balanceJson.ok && balanceJson.data != null) {
        const available = Number(balanceJson.data);
        setBalance(Number.isFinite(available) ? available : 0);
      }

      const positionsJson = await api.getOpenPositions(activeToken);
      if (positionsJson.ok && positionsJson.data != null) {
        const raw = positionsJson.data;
        const positionsList = Array.isArray(raw) ? raw : [raw];

        const formatted: Position[] = positionsList
          .filter((pos: { qty: number }) => pos.qty !== 0)
          .map(
            (pos: {
              market: string;
              qty: number;
              costBasis: number;
              margin: number;
              kind: string;
            }) => ({
              userId: '',
              market: pos.market,
              qty: pos.kind === 'SHORT' ? -Math.abs(pos.qty) : Math.abs(pos.qty),
              entryPrice: pos.qty !== 0 ? Math.abs(pos.costBasis / pos.qty) : 0,
              margin: pos.margin,
            }),
          );

        setBasePositions(formatted);
        void fetchMarkPricesForMarkets(formatted.map((pos) => pos.market));
      }

      const ordersJson = await api.getOpenOrders(activeToken);
      if (ordersJson.ok && Array.isArray(ordersJson.data)) {
        const formattedOrders: Order[] = ordersJson.data.map((ord: any) => ({
          id: ord.orderId || ord.id,
          userId: ord.userId,
          type: ord.type,
          totalQty: ord.qty || ord.totalQty || 0,
          filledQty: ord.filledQty || 0,
          price: ord.price,
          status: ord.status,
          margin: ord.margin,
          kind: ord.kind,
          market: ord.market,
          transactionTime: String(ord.createdAt || ord.transactionTime),
        }));
        setOpenOrders(formattedOrders);
      }

      const fillsJson = await api.getFills(activeToken);
      if (fillsJson.ok && Array.isArray(fillsJson.data)) {
        const formattedFills: Fill[] = fillsJson.data.map((f: any) => ({
          id: f.id || f.orderId,
          orderId: f.orderId,
          buyerId: f.buyerId,
          sellerId: f.sellerId,
          price: f.price,
          qty: f.qty,
          type: f.type,
          kind: f.kind,
          status: f.status,
          transactionTime: String(f.createdAt || f.transactionTime),
        }));
        setFills(formattedFills);
      }
    } catch (err) {
      console.log('[refreshUserData] error', err);
    }
  };

  const signup = async (username: string, password?: string): Promise<boolean> => {
    try {
      const json = await api.signup(username, password);
      if (json.status === 201 && json.token && json.user) {
        setToken(json.token);
        setUser(json.user);
        localStorage.setItem('perp_token', json.token);
        localStorage.setItem('perp_user', JSON.stringify(json.user));

        await performOnramp(json.token, 10000);
        return true;
      }
      return false;
    } catch (err) {
      console.log('[signup] error', err);
      return false;
    }
  };

  const login = async (username: string, password?: string): Promise<boolean> => {
    try {
      const json = await api.signin(username, password);
      if (json.status === 200 && json.token && json.user) {
        setToken(json.token);
        setUser(json.user);
        localStorage.setItem('perp_token', json.token);
        localStorage.setItem('perp_user', JSON.stringify(json.user));
        await refreshUserData(json.token);
        return true;
      }
      return false;
    } catch (err) {
      console.log('[login] error', err);
      return false;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setBalance(0);
    setBasePositions([]);
    setMarkPricesByMarket({});
    setOpenOrders([]);
    setFills([]);
    localStorage.removeItem('perp_token');
    localStorage.removeItem('perp_user');
  };

  const performOnramp = async (authToken: string, amount: number): Promise<{ ok: boolean; msg?: string }> => {
    try {
      const json = await api.onramp(authToken, amount);
      if (json.ok) {
        const nextBalance = Number(json.data);
        if (Number.isFinite(nextBalance)) {
          setBalance(nextBalance);
        }
        await refreshUserData(authToken);
        return { ok: true };
      }
      return { ok: false, msg: json.msg || 'Deposit failed' };
    } catch (err) {
      console.log('[performOnramp] error', err);
      return { ok: false, msg: 'Could not reach the backend' };
    }
  };

  const deposit = async (amount: number): Promise<{ ok: boolean; msg?: string }> => {
    if (!token) return { ok: false, msg: 'Please log in to deposit funds' };
    return performOnramp(token, amount);
  };

  const placeOrder = async (
    qty: string,
    price: number,
    type: 'LIMIT' | 'MARKET',
    kind: 'LONG' | 'SHORT',
    margin: number,
  ): Promise<any> => {
    if (!token) {
      throw new Error('User must be logged in to trade');
    }

    try {
      const json = await api.placeOrder(token, {
        qty,
        price,
        market,
        type,
        kind,
        margin,
      });

      if (json.status === 200 && json.ok) {
        refreshUserData();
        return json.data;
      } else {
        throw new Error(json.msg || 'parse error ');
      }
    } catch (err: any) {
      console.log('[placeOrder] error', err);
      throw err;
    }
  };

  const cancelOrder = async (orderId: string): Promise<boolean> => {
    if (!token) return false;

    try {
      const json = await api.cancelOrder(token, orderId);

      if (json.status === 200 && json.ok) {
        refreshUserData();
        return true;
      }
      return false;
    } catch (err) {
      console.log('[cancelOrder] error', err);
      return false;
    }
  };

  return (
    <TradingContext.Provider
      value={{
        market,
        setMarket,
        chartInterval,
        setChartInterval,
        candles,
        loadingCandles,
        wsReady,
        token,
        user,
        balance,
        bids,
        asks,
        lastPrice,
        markPrice,
        previewFundingRate,
        fundingCountdown,
        marketTrades,
        marketLiquidations,
        openPositions: openPositionsWithPnl,
        openOrders,
        fills,
        loadingDepth,
        authModalMode,
        setAuthModalMode,
        login,
        signup,
        logout,
        deposit,
        placeOrder,
        cancelOrder,
        refreshUserData,
      }}
    >
      {children}
    </TradingContext.Provider>
  );
};
