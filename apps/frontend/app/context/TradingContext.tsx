"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";

import type { OrderBookRow, Position, Order, Fill } from "types";
import { useApi, WS_BASE } from "../hooks/useApi";
import {
  computeFundingRatePreview,
  startFundingTimer,
  fundingMsRemaining,
  formatCountdown,
} from "../utils/funding";
import { parseDepthSnapshot } from "../utils/orderbook";

export interface MarketTrade {
  price: number;
  qty: number;
  time: number;
}

interface TradingContextType {
  market: "BTCUSD" | "ETHUSD" | "SOLUSD";
  setMarket: (market: "BTCUSD" | "ETHUSD" | "SOLUSD") => void;
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
  openPositions: Position[];
  openOrders: Order[];
  fills: Fill[];
  loadingDepth: boolean;
  authModalMode: "login" | "signup" | null;
  setAuthModalMode: (mode: "login" | "signup" | null) => void;
  login: (username: string, password?: string) => Promise<boolean>;
  signup: (username: string, password?: string) => Promise<boolean>;
  logout: () => void;
  deposit: (amount: number) => Promise<boolean>;
  placeOrder: (qty: string, price: number, type: "LIMIT" | "MARKET", kind: "LONG" | "SHORT", margin: number) => Promise<any>;
  cancelOrder: (orderId: string) => Promise<boolean>;
  refreshUserData: () => void;
}

const TradingContext = createContext<TradingContextType | undefined>(undefined);

export const useTrading = () => {
  const context = useContext(TradingContext);
  if (!context) {
    throw new Error("useTrading must be used within a TradingProvider");
  }
  return context;
};

const MAX_MARKET_TRADES = 100;

export const TradingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const api = useApi();
  const [market, setMarket] = useState<"BTCUSD" | "ETHUSD" | "SOLUSD">("BTCUSD");
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; username: string } | null>(null);
  const [balance, setBalance] = useState<number>(0);
  
  // Orderbook and Price Stats State
  const [bids, setBids] = useState<OrderBookRow[]>([]);
  const [asks, setAsks] = useState<OrderBookRow[]>([]);
  const [lastPrice, setLastPrice] = useState<number>(0);
  const [markPrice, setMarkPrice] = useState<number>(0);
  const [fundingDeadline, setFundingDeadline] = useState(() => startFundingTimer());
  const [fundingCountdown, setFundingCountdown] = useState("08:00:00");
  const [marketTrades, setMarketTrades] = useState<MarketTrade[]>([]);
  const [loadingDepth, setLoadingDepth] = useState<boolean>(true);

  const previewFundingRate = computeFundingRatePreview(markPrice, lastPrice);

  // User Trade State
  const [openPositions, setOpenPositions] = useState<Position[]>([]);
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [fills, setFills] = useState<Fill[]>([]);
  const [authModalMode, setAuthModalMode] = useState<"login" | "signup" | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const tokenRef = useRef<string | null>(token);
  const marketRef = useRef(market);
  const [wsReconnectNonce, setWsReconnectNonce] = useState(0);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    marketRef.current = market;
  }, [market]);

  useEffect(() => {
    const tick = () =>
      setFundingCountdown(formatCountdown(fundingMsRemaining(fundingDeadline)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [fundingDeadline]);

  // Load auth state from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("perp_token");
    const savedUser = localStorage.getItem("perp_user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // Reset stats when market changes
  useEffect(() => {
    setBids([]);
    setAsks([]);
    setLoadingDepth(true);
    setLastPrice(0);
    setMarkPrice(0);
    setMarketTrades([]);
    setFundingDeadline(startFundingTimer());
  }, [market]);

  // Periodic user data refresh
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      refreshUserData();
    }, 3000);
    return () => clearInterval(interval);
  }, [market, token]);

  // WebSocket connection management
  useEffect(() => {
    console.log(`Connecting to WebSocket: ${WS_BASE}`);
    const ws = new WebSocket(WS_BASE);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected successfully");
      // 1. Subscribe to streams for the current market
      subscribeToMarket(ws, market);
      // 2. Perform one-time initial HTTP requests after WS is set up
      fetchDepth();
      fetchLastPrice();
      if (tokenRef.current) {
        refreshUserData();
      }
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.data && payload.stream) {
          const { stream, data } = payload;
          const streamMarket = stream.split(".")[1];
          if (streamMarket !== marketRef.current) return;

          if (stream.startsWith("depth")) {
            const { bids: rawBids, asks: rawAsks } = parseDepthSnapshot(data.bids, data.asks);
            setBids(rawBids);
            setAsks(rawAsks);
            setLoadingDepth(false);
          } else if (stream.startsWith("trade")) {
            const trade: MarketTrade = {
              price: Number(data.price),
              qty: Number(data.qty),
              time: Number(data.transactionTime ?? data.executionTime ?? Date.now()),
            };
            if (trade.price > 0 && trade.qty > 0) {
              setMarketTrades((prev) => [trade, ...prev].slice(0, MAX_MARKET_TRADES));
            }
          } else if (stream.startsWith("lastTradedPrice")) {
            const price = Number(data.price);
            if (price > 0) setLastPrice(price);
          } else if (stream.startsWith("markPrice")) {
            const price = Number(data.price);
            if (price > 0) setMarkPrice(price);
          } else if (stream.startsWith("funding")) {
            setFundingDeadline(startFundingTimer());
            if (tokenRef.current) {
              refreshUserData();
            }
          }
        }
      } catch (err) {
        console.error("WebSocket message parse error:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket connection error:", err);
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed, reconnecting in 3 seconds...");
      setTimeout(() => {
        setWsReconnectNonce((n) => n + 1);
      }, 3000);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        unsubscribeFromMarket(ws, market);
      }
      ws.close();
    };
  }, [market, wsReconnectNonce]);

  const subscribeToMarket = (ws: WebSocket, targetMarket: string) => {
    const streams = [
      `depth.${targetMarket}`,
      `markPrice.${targetMarket}`,
      `lastTradedPrice.${targetMarket}`,
      `trade.${targetMarket}`,
      `funding.${targetMarket}`,
    ];
    ws.send(JSON.stringify({
      method: "SUBSCRIBE",
      params: streams,
      id: 1
    }));
  };

  const unsubscribeFromMarket = (ws: WebSocket, targetMarket: string) => {
    const streams = [
      `depth.${targetMarket}`,
      `markPrice.${targetMarket}`,
      `lastTradedPrice.${targetMarket}`,
      `trade.${targetMarket}`,
      `funding.${targetMarket}`,
    ];
    ws.send(JSON.stringify({
      method: "UNSUBSCRIBE",
      params: streams,
      id: 2
    }));
  };

  const applyDepthFromApi = (rawBids: unknown, rawAsks: unknown) => {
    const { bids: bidsList, asks: asksList } = parseDepthSnapshot(rawBids, rawAsks);
    setBids(bidsList);
    setAsks(asksList);
    setLoadingDepth(false);
  };

  // Initial book snapshot only — live updates come from depth_updated over WS
  const fetchDepth = async () => {
    try {
      const json = await api.getDepth(market);
      if (json.ok && json.data) {
        applyDepthFromApi(json.data.bids, json.data.asks);
      }
    } catch {
    }
  };

  // API Call: Fetch Last Traded Price (from local fills — only updates when a real trade occurs)
  const fetchLastPrice = async () => {
    try {
      const json = await api.getTickerPrice(market);
      if (json.ok && json.price && Number(json.price) > 0) {
        setLastPrice(Number(json.price));
      }
    } catch {
      // Backend not yet reachable — silently skip
    }
  };

  // API Call: Refresh user balance, positions, open orders, and fills
  const refreshUserData = async (authToken?: string) => {
    const activeToken = authToken ?? token;
    if (!activeToken) return;

    try {
      const balanceJson = await api.getAvailableEquity(activeToken, market);
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
          .map((pos: { market: string; qty: number; costBasis: number; margin: number; kind: string }) => ({
            userId: "",
            market: pos.market,
            qty: pos.kind === "SHORT" ? -Math.abs(pos.qty) : Math.abs(pos.qty),
            entryPrice: pos.qty !== 0 ? Math.abs(pos.costBasis / pos.qty) : 0,
            margin: pos.margin,
          }));
        
        // Calculate dynamic PnL using the current markPrice
        const withPnl = formatted.map(pos => {
          const sign = pos.qty > 0 ? 1 : -1;
          const currentP = (pos.market === market && markPrice > 0) ? markPrice : pos.entryPrice;
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
          transactionTime: String(ord.createdAt || ord.transactionTime)
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
          transactionTime: String(f.createdAt || f.transactionTime)
        }));
        setFills(formattedFills);
      }
    } catch {
      // Backend not yet reachable or temporarily down — silently skip refresh
    }
  };

  // Action: Register/Signup
  const signup = async (username: string, password?: string): Promise<boolean> => {
    try {
      const json = await api.signup(username, password);
      if (json.status === 201 && json.token && json.user) {
        setToken(json.token);
        setUser(json.user);
        localStorage.setItem("perp_token", json.token);
        localStorage.setItem("perp_user", JSON.stringify(json.user));
        
        await performOnramp(json.token, 10000);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Signup failed:", err);
      return false;
    }
  };

  // Action: Login/Signin
  const login = async (username: string, password?: string): Promise<boolean> => {
    try {
      const json = await api.signin(username, password);
      if (json.status === 200 && json.token && json.user) {
        setToken(json.token);
        setUser(json.user);
        localStorage.setItem("perp_token", json.token);
        localStorage.setItem("perp_user", JSON.stringify(json.user));
        await refreshUserData(json.token);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Login failed:", err);
      return false;
    }
  };

  // Action: Logout
  const logout = () => {
    setToken(null);
    setUser(null);
    setBalance(0);
    setOpenPositions([]);
    setOpenOrders([]);
    setFills([]);
    localStorage.removeItem("perp_token");
    localStorage.removeItem("perp_user");
  };

  // Helper deposit function
  const performOnramp = async (authToken: string, amount: number): Promise<boolean> => {
    try {
      const json = await api.onramp(authToken, amount);
      if (json.status === 201 && json.ok) {
        await refreshUserData(authToken);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Deposit onramp failed:", err);
      return false;
    }
  };

  // Action: Deposit USD
  const deposit = async (amount: number): Promise<boolean> => {
    if (!token) return false;
    return performOnramp(token, amount);
  };

  // Action: Place Order
  const placeOrder = async (
    qty: string,
    price: number,
    type: "LIMIT" | "MARKET",
    kind: "LONG" | "SHORT",
    margin: number
  ): Promise<any> => {
    if (!token) {
      throw new Error("User must be logged in to trade");
    }

    
    try {
      const json = await api.placeOrder(token, {
        qty,
        price,
        market,
        type,
        kind,
        margin
      });
      
      if (json.status === 200 && json.ok) {
        refreshUserData();
        return json.data;
      } else {
        throw new Error(json.msg || "parse error ");
      }
    } catch (err: any) {
    console.error("Order submission failed:", err);
      throw err;
    }
  };

  // Action: Cancel Order
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
      console.error("Cancel order failed:", err);
      return false;
    }
  };

  return (
    <TradingContext.Provider
      value={{
        market,
        setMarket,
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
        refreshUserData
      }}
    >
      {children}
    </TradingContext.Provider>
  );
};

