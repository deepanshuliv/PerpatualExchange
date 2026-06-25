"use client";

import React, { useState } from "react";
import { useTrading } from "../context/TradingContext";
import { Info, Plus, LogOut } from "lucide-react";

export default function DashboardTabs() {
  const {
    openPositions,
    openOrders,
    fills,
    deposit,
    balance,
    logout,
    user,
    market,
    cancelOrder
  } = useTrading();

  const [activeTab, setActiveTab] = useState<"positions" | "orders" | "fills">("positions");
  const [depositing, setDepositing] = useState(false);
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());

  const handleCancel = async (orderId: string) => {
    setCancellingIds((prev) => {
      const next = new Set(prev);
      next.add(orderId);
      return next;
    });
    try {
      await cancelOrder(orderId);
    } catch (e) {
      console.error("Error cancelling order:", e);
    } finally {
      setCancellingIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const handleDeposit = async () => {
    setDepositing(true);
    try {
      await deposit(1000); // Deposit $1,000 mock USD
    } catch (e) {
      console.error(e);
    } finally {
      setDepositing(false);
    }
  };

  const getSideBadge = (qty: number | string, kind?: string) => {
    const isLong = typeof qty === "number" ? qty > 0 : kind === "LONG";
    return isLong ? (
      <span className="text-[#00c087] bg-[#00c087]/10 px-1.5 py-0.5 rounded text-[10px] font-bold">LONG</span>
    ) : (
      <span className="text-[#ff3b30] bg-[#ff3b30]/10 px-1.5 py-0.5 rounded text-[10px] font-bold">SHORT</span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0c0d10] text-[#f2f4f7] border-t border-[#171a1f] select-none font-sans">
      {/* Tab bar header */}
      <div className="flex items-center justify-between border-b border-[#171a1f] bg-[#08090b] px-4 h-11 shrink-0">
        <div className="flex space-x-2">
          {[
            { id: "positions", label: `Positions (${openPositions.length})` },
            { id: "orders", label: `Open Orders (${openOrders.length})` },
            { id: "fills", label: "Trade History" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${
                activeTab === tab.id
                  ? "bg-[#171a1f] text-white"
                  : "text-[#8491a5] hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* User Balance & Onramp Controls */}
        <div className="flex items-center space-x-4 text-xs">
          {user && (
            <div className="flex items-center space-x-2 border-r border-[#171a1f] pr-4 text-[#8491a5]">
              <span>Logged in as: <strong className="text-white">{user.username}</strong></span>
              <button 
                onClick={logout} 
                className="hover:text-red-400 p-0.5 rounded hover:bg-[#171a1f] transition-colors" 
                title="Logout"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <span className="text-[#8491a5]">Available Equity:</span>
            <span className="font-mono text-[#00c087] font-bold">${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <button
              onClick={handleDeposit}
              disabled={depositing}
              className="flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-zinc-200 text-black font-bold text-[10px] rounded transition-colors disabled:opacity-50"
            >
              <Plus className="h-3 w-3" />
              <span>{depositing ? "Depositing..." : "Deposit $1k"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tab content area */}
      <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 text-xs font-mono">
        {activeTab === "positions" && (
          <div className="min-w-full">
            {openPositions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-[#8491a5] font-sans">
                <Info className="h-5 w-5 mb-1.5 opacity-50" />
                <span>No open positions</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[#8491a5] border-b border-[#171a1f] bg-[#0c0d10] font-sans text-[10px] font-semibold sticky top-0">
                    <th className="px-4 py-2">Market</th>
                    <th className="px-4 py-2">Side</th>
                    <th className="px-4 py-2 text-right">Size</th>
                    <th className="px-4 py-2 text-right">Entry Price</th>
                    <th className="px-4 py-2 text-right">Margin</th>
                    <th className="px-4 py-2 text-right">Unrealized PnL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#171a1f]">
                  {openPositions.map((pos, idx) => {
                    const pnlVal = pos.pnl || 0;
                    return (
                      <tr key={`pos-${idx}`} className="hover:bg-[#12151c]/40 transition-colors">
                        <td className="px-4 py-2 text-white font-sans font-bold">{pos.market}</td>
                        <td className="px-4 py-2">{getSideBadge(pos.qty)}</td>
                        <td className="px-4 py-2 text-right text-white font-bold">{Math.abs(pos.qty).toFixed(4)}</td>
                        <td className="px-4 py-2 text-right text-[#b0bbcb]">${pos.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                        <td className="px-4 py-2 text-right text-[#b0bbcb]">${pos.margin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className={`px-4 py-2 text-right font-bold ${pnlVal >= 0 ? "text-[#00c087]" : "text-[#ff3b30]"}`}>
                          {pnlVal >= 0 ? "+" : ""}${pnlVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "orders" && (
          <div className="min-w-full">
            {openOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-[#8491a5] font-sans">
                <Info className="h-5 w-5 mb-1.5 opacity-50" />
                <span>No open orders</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[#8491a5] border-b border-[#171a1f] bg-[#0c0d10] font-sans text-[10px] font-semibold sticky top-0">
                    <th className="px-4 py-2">Market</th>
                    <th className="px-4 py-2">Side</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2 text-right">Price</th>
                    <th className="px-4 py-2 text-right">Filled / Total</th>
                    <th className="px-4 py-2 text-center">Status</th>
                    <th className="px-4 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#171a1f]">
                  {openOrders.map((ord, idx) => (
                    <tr key={`ord-${idx}`} className="hover:bg-[#12151c]/40 transition-colors">
                      <td className="px-4 py-2 text-white font-sans font-bold">{ord.market}</td>
                      <td className="px-4 py-2">{getSideBadge(ord.totalQty, ord.kind)}</td>
                      <td className="px-4 py-2 text-[#b0bbcb] font-sans text-[10px]">{ord.type}</td>
                      <td className="px-4 py-2 text-right text-white font-bold">${ord.price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                      <td className="px-4 py-2 text-right text-[#b0bbcb]">{ord.filledQty.toFixed(4)} / {ord.totalQty.toFixed(4)}</td>
                      <td className="px-4 py-2 text-center">
                        <span className="bg-[#171a1f] text-white px-2 py-0.5 rounded text-[10px] font-sans">
                          {ord.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => handleCancel(ord.id)}
                          disabled={cancellingIds.has(ord.id)}
                          className="text-[#ff3b30] hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 rounded text-[10px] font-sans font-bold transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {cancellingIds.has(ord.id) ? "Cancelling..." : "Cancel"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "fills" && (
          <div className="min-w-full">
            {fills.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-[#8491a5] font-sans">
                <Info className="h-5 w-5 mb-1.5 opacity-50" />
                <span>No trade executions found</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[#8491a5] border-b border-[#171a1f] bg-[#0c0d10] font-sans text-[10px] font-semibold sticky top-0">
                    <th className="px-4 py-2">Side</th>
                    <th className="px-4 py-2 text-right">Price</th>
                    <th className="px-4 py-2 text-right">Quantity</th>
                    <th className="px-4 py-2 text-right">Execution Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#171a1f]">
                  {[...fills].reverse().map((fill, idx) => (
                    <tr key={`fill-${idx}`} className="hover:bg-[#12151c]/40 transition-colors">
                      <td className="px-4 py-2">{getSideBadge(fill.qty, fill.kind)}</td>
                      <td className="px-4 py-2 text-right text-white font-bold">${fill.price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                      <td className="px-4 py-2 text-right text-[#b0bbcb]">{fill.qty.toFixed(4)}</td>
                      <td className="px-4 py-2 text-right text-zinc-500 text-[10px]">
                        {new Date(fill.transactionTime).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
