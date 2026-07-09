'use client';

import { createCorrelationId } from '../utils/correlationId';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';

export interface PlaceOrderParams {
  qty: string;
  price: number;
  market: string;
  type: 'LIMIT' | 'MARKET';
  kind: 'LONG' | 'SHORT';
  margin: number;
}

const getHeaders = (token?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const apiService = {
  getDepth: async (market: string) => {
    const res = await fetch(`${API_BASE}/depth/${market}`, {
      headers: getHeaders(),
    });
    return res.json();
  },

  getTickerPrice: async (market: string) => {
    const res = await fetch(`${API_BASE}/ticker/price/${market}`, {
      headers: getHeaders(),
    });
    return res.json();
  },

  getMarkPrice: async (market: string) => {
    const res = await fetch(`${API_BASE}/ticker/mark/${market}`, {
      headers: getHeaders(),
    });
    return res.json();
  },

  getLiquidations: async (market: string) => {
    const res = await fetch(`${API_BASE}/liquidations/${market}`, {
      headers: getHeaders(),
    });
    return res.json();
  },

  getTrades: async (market: string) => {
    const res = await fetch(`${API_BASE}/trades/${market}`, {
      headers: getHeaders(),
    });
    return res.json();
  },

  getCandles: async (market: string, interval: '1h' | '1d', limit = 200) => {
    const res = await fetch(`${API_BASE}/candles/${market}/${interval}?limit=${limit}`, {
      headers: getHeaders(),
    });
    return res.json();
  },

  getAvailableEquity: async (token: string) => {
    const res = await fetch(`${API_BASE}/equity/available`, {
      headers: getHeaders(token),
    });
    return res.json();
  },

  getOpenPositions: async (token: string) => {
    const res = await fetch(`${API_BASE}/positions/open/all`, {
      headers: getHeaders(token),
    });
    return res.json();
  },

  getOpenOrders: async (token: string) => {
    const res = await fetch(`${API_BASE}/orders/open/all`, {
      headers: getHeaders(token),
    });
    return res.json();
  },

  getFills: async (token: string) => {
    const res = await fetch(`${API_BASE}/fills`, {
      headers: getHeaders(token),
    });
    return res.json();
  },

  provisionSimUser: async (label: string, amount: number) => {
    const res = await fetch(`${API_BASE}/sim/provision`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ label, amount }),
    });
    const json = await res.json();
    return { status: res.status, ...json };
  },

  injectMarkPrice: async (market: string, price: number) => {
    const res = await fetch(`${API_BASE}/sim/inject-mark-price`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ market, price }),
    });
    const json = await res.json();
    return { status: res.status, ...json };
  },

  signup: async (username: string, password?: string) => {
    const res = await fetch(`${API_BASE}/signup`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ username, password: password }),
    });
    const json = await res.json();
    return { status: res.status, ...json };
  },

  signin: async (username: string, password?: string) => {
    const res = await fetch(`${API_BASE}/signin`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ username, password: password }),
    });
    const json = await res.json();
    return { status: res.status, ...json };
  },

  onramp: async (token: string, amount: number) => {
    const res = await fetch(`${API_BASE}/onramp`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({
        correlationId: createCorrelationId(),
        type: 'add_balance',
        data: { amount },
      }),
    });
    const json = await res.json();
    return { status: res.status, ...json };
  },

  placeOrder: async (token: string, orderData: PlaceOrderParams) => {
    const res = await fetch(`${API_BASE}/order`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({
        correlationId: createCorrelationId(),
        type: 'create_order',
        data: {
          qty: String(orderData.qty),
          price: String(orderData.price),
          market: orderData.market,
          type: orderData.type,
          kind: orderData.kind,
          margin: String(orderData.margin),
        },
      }),
    });
    const json = await res.json();
    return { status: res.status, ...json };
  },

  cancelOrder: async (token: string, orderId: string) => {
    const res = await fetch(`${API_BASE}/order/cancel`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({
        correlationId: createCorrelationId(),
        type: 'cancel_order',
        data: { orderId },
      }),
    });
    const json = await res.json();
    return { status: res.status, ...json };
  },
};

export const useApi = () => {
  return apiService;
};
