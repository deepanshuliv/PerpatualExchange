"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";

import type { OrderBookRow, Position, Order, Fill } from "types";
import { useApi } from "../hooks/useApi";
import { log } from "console";

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
  high24h: number;
  low24h: number;
  volume24h: number;
  openInterest: number;
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

const WS_BASE = "ws://localhost:8080";

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
  const [high24h, setHigh24h] = useState<number>(0);
  const [low24h, setLow24h] = useState<number>(0);
  const [volume24h, setVolume24h] = useState<number>(0);
  const [openInterest, setOpenInterest] = useState<number>(0);
  const [loadingDepth, setLoadingDepth] = useState<boolean>(true);

  // User Trade State
  const [openPositions, setOpenPositions] = useState<Position[]>([]);
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [fills, setFills] = useState<Fill[]>([]);
  const [authModalMode, setAuthModalMode] = useState<"login" | "signup" | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const tokenRef = useRef<string | null>(token);
  // Track whether the backend API is reachable; suppresses console noise on startup
  const backendAvailable = useRef<boolean>(false);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

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
    setLastPrice(0);
    setMarkPrice(0);
    setHigh24h(0);
    setLow24h(0);
    setVolume24h(0);
    setOpenInterest(0);
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
          if (streamMarket !== market) return; // Only process current market updates

          if (stream.startsWith("lastTradedPrice")) {
            // Last Price: price of the most recent trade on OUR local exchange (from fills)
            setLastPrice(Number(data.price));
          } else if (stream.startsWith("markPrice")) {
            // Mark Price / Index Price: Binance Futures mark price
            const price = Number(data.price);
            setMarkPrice(price);
            // Derive approximate 24h stats from live mark price
            setHigh24h(price * 1.024);
            setLow24h(price * 0.957);
            setVolume24h(price * 2345.67);
            setOpenInterest(price * 0.0071);
          } else if (stream.startsWith("bookTicker")) {
            // bookTicker carries best bid/ask from local order book
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
        // Re-trigger useEffect connection
        setMarket((prev) => prev);
      }, 3000);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        unsubscribeFromMarket(ws, market);
      }
      ws.close();
    };
  }, [market]);

  const subscribeToMarket = (ws: WebSocket, targetMarket: string) => {
    const streams = [
      `depth.${targetMarket}`,
      `markPrice.${targetMarket}`,
      `bookTicker.${targetMarket}`,
      `lastTradedPrice.${targetMarket}`
    ];
    console.log("Subscribing to WebSocket streams:", streams);
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
      `bookTicker.${targetMarket}`,
      `lastTradedPrice.${targetMarket}`
    ];
    console.log("Unsubscribing from WebSocket streams:", streams);
    ws.send(JSON.stringify({
      method: "UNSUBSCRIBE",
      params: streams,
      id: 2
    }));
  };

  // API Call: Fetch Order Book Depth
  const fetchDepth = async () => {
    try {
      const json = await api.getDepth(market);
      backendAvailable.current = true;
      if (json.ok && json.data) {
        const rawBids = json.data.bids || {};
        const rawAsks = json.data.asks || {};

        let bidsList: OrderBookRow[] = Object.entries(rawBids).map(([p, q]) => ({
          price: parseFloat(p),
          size: parseFloat(q as string),
          total: 0,
        })).sort((a, b) => b.price - a.price);

        let asksList: OrderBookRow[] = Object.entries(rawAsks).map(([p, q]) => ({
          price: parseFloat(p),
          size: parseFloat(q as string),
          total: 0,
        })).sort((a, b) => b.price - a.price);

        let bidsAccum = 0;
        bidsList = bidsList.map((row) => {
          bidsAccum += row.size;
          return { ...row, total: bidsAccum };
        });

        let asksAccum = 0;
        const reversedAsks = [...asksList].reverse();
        const asksWithTotals = reversedAsks.map((row) => {
          asksAccum += row.size;
          return { ...row, total: asksAccum };
        });
        asksList = asksWithTotals.reverse();

        setBids(bidsList);
        setAsks(asksList);
        setLoadingDepth(false);
      }
    } catch {
      // Backend not yet reachable — silently skip; WS or next poll will retry
      backendAvailable.current = false;
    }
  };

  // API Call: Fetch Last Traded Price (from local fills — only updates when a real trade occurs)
  const fetchLastPrice = async () => {
    try {
      const json = await api.getTickerPrice(market);
      backendAvailable.current = true;
      if (json.ok && json.price && Number(json.price) > 0) {
        setLastPrice(Number(json.price));
      }
    } catch {
      // Backend not yet reachable — silently skip
      backendAvailable.current = false;
    }
  };

  // API Call: Refresh user balance, positions, open orders, and fills
  const refreshUserData = async () => {
    if (!token) return;

    try {
      // 1. Fetch balance (available equity)
      const balanceJson = await api.getAvailableEquity(token, market);
      if (balanceJson.ok && balanceJson.data) {
        // available balance is in balanceJson.data
        setBalance(balanceJson.data.availableBalance || 0);
      }

      // 2. Fetch open positions
      const positionsJson = await api.getOpenPositions(token);
      if (positionsJson.ok && positionsJson.data) {
        // format values from engine: {"positions": {...}} or similar
        const positionsMap = positionsJson.data.positions || {};
        const formatted: Position[] = Object.entries(positionsMap).map(([mkt, pos]: [string, any]) => ({
          userId: pos.userId,
          market: mkt,
          qty: pos.qty,
          entryPrice: pos.entryPrice || (pos.qty !== 0 ? Math.abs(pos.costBasis / pos.qty) : 0),
          margin: pos.margin
        })).filter(p => p.qty !== 0); // Hide empty positions
        
        // Calculate dynamic PnL using the current markPrice
        const withPnl = formatted.map(pos => {
          const sign = pos.qty > 0 ? 1 : -1;
          const currentP = (pos.market === market && markPrice > 0) ? markPrice : pos.entryPrice;
          const pnl = sign * Math.abs(pos.qty) * (currentP - pos.entryPrice);
          return { ...pos, pnl };
        });
        setOpenPositions(withPnl);
      }

      // 3. Fetch open orders
      const ordersJson = await api.getOpenOrders(token);
      if (ordersJson.ok && ordersJson.data) {
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

      // 4. Fetch fills
      const fillsJson = await api.getFills(token);
      if (fillsJson.ok && fillsJson.data) {
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
      backendAvailable.current = false;
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
        
        // Auto deposit 10,000 USD on signup
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
        refreshUserData();
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
        console.log(json.data)
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
        high24h,
        low24h,
        volume24h,
        openInterest,
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

