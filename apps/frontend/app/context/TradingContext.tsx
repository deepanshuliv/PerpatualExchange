'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

import type { Fill, Order, OrderBookRow, Position } from 'types';
import { useApi, WS_BASE } from '../hooks/useApi';
import {
  computeFundingRatePreview,
  formatCountdown,
  fundingMsRemaining,
  startFundingTimer,
} from '../utils/funding';
import { parseDepthSnapshot } from '../utils/orderbook';

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

export type ChartInterval = '1h' | '1d';

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
  deposit: (amount: number) => Promise<boolean>;
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
  const [chartInterval, setChartInterval] = useState<ChartInterval>('1h');
  const [candles, setCandles] = useState<ChartCandle[]>([]);
  const [loadingCandles, setLoadingCandles] = useState<boolean>(true);

  const previewFundingRate = computeFundingRatePreview(markPrice, lastPrice);

  const [openPositions, setOpenPositions] = useState<Position[]>([]);
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [fills, setFills] = useState<Fill[]>([]);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup' | null>(null);

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
          if (price > 0) setLastPrice(price);
          return;
        }

        if (stream.startsWith('markPrice')) {
          const price = Number(data.price);
          if (price > 0) setMarkPrice(price);
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

          const candle: ChartCandle = {
            openTime: Number(data.openTime),
            open: Number(data.open),
            high: Number(data.high),
            low: Number(data.low),
            close: Number(data.close),
            volume: Number(data.volume),
          };

          if (!Number.isFinite(candle.openTime) || candle.open <= 0) return;

          setCandles((prev) => {
            if (prev.length === 0) return [candle];
            const last = prev[prev.length - 1]!;
            if (last.openTime === candle.openTime) {
              return [...prev.slice(0, -1), candle];
            }
            if (last.openTime < candle.openTime) {
              return [...prev, candle];
            }
            return prev;
          });
          setLoadingCandles(false);
        }
      } catch (err) {
        console.log('WebSocket message parse error:', err);
      }
    };

    ws.onerror = () => {
      if (!closedByCleanup) {
        console.log(`WebSocket connection error (${WS_BASE})`);
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

    // HTTP endpoints load after WS is connected and subscribed.
    fetchDepth();
    fetchLastPrice();
    fetchLiquidations();
    fetchCandles();

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
  };

  const fetchDepth = async () => {
    try {
      const json = await api.getDepth(market);
      if (json.ok && json.data) {
        applyDepthFromApi(json.data.bids, json.data.asks);
      }
    } catch {}
  };

  const fetchLastPrice = async () => {
    try {
      const json = await api.getTickerPrice(market);
      if (json.ok && json.price && Number(json.price) > 0) {
        setLastPrice(Number(json.price));
      }
    } catch {
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
        setMarketLiquidations(formatted);
      }
    } catch {
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
          if (prev.length === 0) return formatted;
          const lastHttp = formatted[formatted.length - 1];
          const lastLive = prev[prev.length - 1];
          if (!lastHttp || !lastLive) return formatted;
          if (lastLive.openTime >= lastHttp.openTime) {
            const older = formatted.filter((c) => c.openTime < lastLive.openTime);
            return [...older, lastLive];
          }
          return formatted;
        });
      }
    } catch {
    } finally {
      setLoadingCandles(false);
    }
  };

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

        const withPnl = formatted.map((pos) => {
          const sign = pos.qty > 0 ? 1 : -1;
          const currentP = pos.market === market && markPrice > 0 ? markPrice : pos.entryPrice;
          const pnl = sign * Math.abs(pos.qty) * (currentP - pos.entryPrice);
          return { ...pos, pnl };
        });
        setOpenPositions(withPnl);
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
    } catch {
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
      console.log('Signup failed:', err);
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
      console.log('Login failed:', err);
      return false;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setBalance(0);
    setOpenPositions([]);
    setOpenOrders([]);
    setFills([]);
    localStorage.removeItem('perp_token');
    localStorage.removeItem('perp_user');
  };

  const performOnramp = async (authToken: string, amount: number): Promise<boolean> => {
    try {
      const json = await api.onramp(authToken, amount);
      if (json.status === 201 && json.ok) {
        await refreshUserData(authToken);
        return true;
      }
      return false;
    } catch (err) {
      console.log('Deposit onramp failed:', err);
      return false;
    }
  };

  const deposit = async (amount: number): Promise<boolean> => {
    if (!token) return false;
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
      console.log('Order submission failed:', err);
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
      console.log('Cancel order failed:', err);
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
        openPositions,
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
