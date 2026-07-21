"use client";

import React, { useState } from "react";
import { useTrading } from "./context/TradingContext";
import TradingChart from "./components/TradingChart";
import OrderBook from "./components/OrderBook";
import OrderEntryPanel from "./components/OrderEntryPanel";
import DashboardTabs from "./components/DashboardTabs";
import AuthModal from "./components/AuthModal";
import ConfirmModal from "./components/ConfirmModal";
import { formatFundingRate } from "./utils/funding";
import {
  ChevronDown,
  ChevronRight,
  TrendingUp,
  LogOut
} from "lucide-react";

export default function Home() {
  const {
    market,
    setMarket,
    lastPrice,
    markPrice,
    previewFundingRate,
    fundingCountdown,
    user,
    logout,
    setAuthModalMode
  } = useTrading();

  const [marketDropdownOpen, setMarketDropdownOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const getMarketLabel = (mkt: string) => {
    if (mkt === "ETHUSD") return "ETH-PERP";
    if (mkt === "SOLUSD") return "SOL-PERP";
    return "BTC-PERP";
  };

  const getMarketLeverageBadge = (mkt: string) => {
    if (mkt === "ETHUSD") return "50x";
    if (mkt === "SOLUSD") return "20x";
    return "75x";
  };

  const getMarketIcon = (mkt: string) => {
    if (mkt === "ETHUSD") {
      return (
        <div className="bg-[#627eea] p-1.5 rounded-full flex items-center justify-center w-6 h-6 text-white font-bold text-[10px]">
          Ξ
        </div>
      );
    }
    if (mkt === "SOLUSD") {
      return (
        <div className="bg-[#14f195] p-1.5 rounded-full flex items-center justify-center w-6 h-6 text-black font-bold text-[10px]">
          S
        </div>
      );
    }
    return (
      <div className="bg-[#f7931a] p-1.5 rounded-full flex items-center justify-center w-6 h-6 text-white font-bold text-[10px]">
        ₿
      </div>
    );
  };

  const get24HChange = () => {
    if (market === "ETHUSD") return { val: "-55.20", pct: "-1.82", isGreen: false };
    if (market === "SOLUSD") return { val: "+3.45", pct: "+2.56", isGreen: true };
    return { val: "-1,000.00", pct: "-1.60", isGreen: false };
  };

  const changeInfo = get24HChange();

  return (
    <div className="flex flex-col min-h-screen bg-[#08090b] text-[#f2f4f7] font-sans selection:bg-zinc-800 selection:text-white">
      <header className="flex items-center justify-between bg-[#0c0d10] border-b border-[#171a1f] px-6 h-14 shrink-0 z-30 select-none">
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-2 cursor-pointer">
            <div className="bg-[#ff3b30] p-1.5 rounded-lg flex items-center justify-center shadow-md">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <span className="text-white font-bold text-sm tracking-wide">
              Backpack
            </span>
          </div>

          <nav className="hidden md:flex items-center space-x-6 text-xs font-semibold text-[#8491a5]">
            <a
              href="#"
              className="text-white border-b-2 border-white pb-4 pt-4 font-bold"
            >
              Futures
            </a>
          </nav>
        </div>

        <div className="flex items-center space-x-4">

          {user ? (
            <div className="flex items-center space-x-3 text-xs">
              <span className="text-[#8491a5]">
                Account: <strong className="text-white">{user.username}</strong>
              </span>
              <button
                onClick={() => setLogoutConfirmOpen(true)}
                className="flex items-center space-x-1.5 bg-[#171a1f] border border-[#242b35] hover:bg-red-500/10 hover:text-red-400 text-zinc-300 font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setAuthModalMode("login")}
                className="text-[#8491a5] hover:text-white bg-[#171a1f]/80 hover:bg-[#1c222b] font-semibold text-xs px-4 py-2 rounded-lg transition-all cursor-pointer"
              >
                Log in
              </button>
              <button
                onClick={() => setAuthModalMode("signup")}
                className="bg-white text-black hover:bg-zinc-200 font-bold text-xs px-4 py-2 rounded-lg transition-all cursor-pointer"
              >
                Sign up
              </button>
            </div>
          )}
        </div>
      </header>

      <section className="flex flex-wrap md:flex-nowrap items-center bg-[#0c0d10] border-b border-[#171a1f] h-auto md:h-14 px-6 py-2 md:py-0 shrink-0 text-xs text-[#8491a5] select-none z-20">
        <div className="relative mr-6 shrink-0 z-20">
          <button
            onClick={() => setMarketDropdownOpen(!marketDropdownOpen)}
            className="flex items-center space-x-2 bg-[#12161c] hover:bg-[#171a1f] border border-[#1d222b] rounded-xl px-3 py-1.5 transition-all text-white font-bold"
          >
            {getMarketIcon(market)}
            <span>{getMarketLabel(market)}</span>
            <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1 rounded font-bold uppercase tracking-wider">
              {getMarketLeverageBadge(market)}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#8491a5]" />
          </button>

          {marketDropdownOpen && (
            <div className="absolute top-11 left-0 bg-[#12161c] border border-[#1d222b] rounded-xl shadow-2xl p-1.5 w-48 flex flex-col space-y-1 z-50">
              {[
                { id: "BTCUSD" as const, label: "BTC-PERP 75x" },
                { id: "ETHUSD" as const, label: "ETH-PERP 50x" },
                { id: "SOLUSD" as const, label: "SOL-PERP 20x" }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setMarket(m.id);
                    setMarketDropdownOpen(false);
                  }}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs font-bold transition-colors cursor-pointer ${
                    market === m.id
                      ? "bg-[#171a1f] text-white"
                      : "hover:bg-[#171a1f]/55 text-zinc-400 hover:text-white"
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    {getMarketIcon(m.id)}
                    <span>{m.label.split(" ")[0]}</span>
                  </div>
                  <span className="text-[10px] text-zinc-500">
                    {m.label.split(" ")[1]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap md:flex-nowrap items-center w-full justify-between gap-4 md:gap-0 mt-2 md:mt-0 font-semibold overflow-hidden">
          <div className="flex flex-col pr-6 border-r border-[#171a1f]/60">
            <span className={`text-sm font-bold leading-none ${changeInfo.isGreen ? "text-[#00c087]" : "text-[#ff3b30]"}`}>
              {lastPrice > 0 ? lastPrice.toLocaleString(undefined, { minimumFractionDigits: 1 }) : "61,643.2"}
            </span>
            <span className="text-[9px] text-[#5d6b7e] mt-1 font-mono font-bold">
              Index: {markPrice > 0 ? markPrice.toLocaleString(undefined, { minimumFractionDigits: 1 }) : "61,644.0"}
            </span>
          </div>

          <div className="flex flex-col px-4 border-r border-[#171a1f]/60 shrink-0">
            <span className="text-[10px] text-[#5d6b7e] uppercase font-bold">Index Price</span>
            <span className="font-mono text-white font-bold mt-0.5">
              {markPrice > 0 ? (markPrice + 1.2).toLocaleString(undefined, { minimumFractionDigits: 1 }) : "61,674.4"}
            </span>
          </div>

          <div className="flex flex-col px-4 border-r border-[#171a1f]/60 shrink-0">
            <span className="text-[10px] text-[#5d6b7e] uppercase font-bold">24H Change</span>
            <span className={`font-mono font-bold mt-0.5 ${changeInfo.isGreen ? "text-[#00c087]" : "text-[#ff3b30]"}`}>
              {changeInfo.val} {changeInfo.pct}%
            </span>
          </div>

          <div className="flex flex-col px-4 border-r border-[#171a1f]/60 shrink-0">
            <span className="text-[10px] text-[#5d6b7e] uppercase font-bold">8H Funding / Countdown</span>
            <span className="font-mono text-[#f59e0b] font-bold mt-0.5">
              {previewFundingRate !== null ? formatFundingRate(previewFundingRate) : "—"}{" "}
              <span className="text-[#8491a5] font-semibold">/</span> {fundingCountdown}
            </span>
          </div>

          <div className="flex flex-col px-4 border-r border-[#171a1f]/60 shrink-0">
            <span className="text-[10px] text-[#5d6b7e] uppercase font-bold">24H High</span>
            <span className="font-mono text-white font-bold mt-0.5">63,140.8</span>
          </div>

          <div className="flex flex-col px-4 border-r border-[#171a1f]/60 shrink-0">
            <span className="text-[10px] text-[#5d6b7e] uppercase font-bold">24H Low</span>
            <span className="font-mono text-white font-bold mt-0.5">59,024.5</span>
          </div>

          <div className="flex flex-col px-4 border-r border-[#171a1f]/60 shrink-0">
            <span className="text-[10px] text-[#5d6b7e] uppercase font-bold">24H Volume (USD)</span>
            <span className="font-mono text-white font-bold mt-0.5">144,610,805.49</span>
          </div>

          <div className="flex flex-col px-4 shrink-0">
            <span className="text-[10px] text-[#5d6b7e] uppercase font-bold">Open Interest ({market === "ETHUSD" ? "ETH" : market === "SOLUSD" ? "SOL" : "BTC"})</span>
            <span className="font-mono text-white font-bold mt-0.5">440.78862</span>
          </div>

          <button className="text-[#8491a5] hover:text-white pl-4 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      <main className="flex-1 flex p-4 gap-4 overflow-hidden min-h-0 w-full">
        <div className="w-[75%] flex flex-col gap-4 min-h-0">
          <div className="flex gap-4 h-[480px] shrink-0 w-full">
            <div className="flex-1 min-h-0">
              <TradingChart />
            </div>
            <div className="w-[30%] shrink-0 h-full min-h-0">
              <OrderBook />
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <DashboardTabs />
          </div>
        </div>
        <div className="w-[25%] flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto no-scrollbar">
            <OrderEntryPanel />
          </div>
        </div>
      </main>

      <footer className="flex items-center justify-between bg-[#08090b] border-t border-[#171a1f] h-9 px-6 shrink-0 z-30 select-none text-[10px] font-semibold text-[#8491a5]">
        <div className="flex items-center space-x-6 overflow-hidden w-full mr-4 relative">
          <div className="flex items-center space-x-1.5 shrink-0 bg-[#08090b] pr-2 z-10 font-bold text-white uppercase tracking-wider">
            <TrendingUp className="w-3.5 h-3.5 text-orange-500" />
            <span>Top Movers</span>
          </div>

          <div className="flex space-x-6 animate-[marquee_25s_linear_infinite] hover:[animation-play-state:paused] whitespace-nowrap">
            {[
              { ticker: "MEGA-PERP", price: "$0.04944", change: "-12.98%", isGreen: false },
              { ticker: "P-PERP", price: "$0.009933", change: "-0.81%", isGreen: false },
              { ticker: "ZORA-PERP", price: "$0.007358", change: "+1.19%", isGreen: true },
              { ticker: "PENGU-PERP", price: "$0.006126", change: "-2.34%", isGreen: false },
              { ticker: "FOGO-PERP", price: "$0.012196", change: "+2.14%", isGreen: true },
              { ticker: "KMNO-PERP", price: "$0.076412", change: "+0.45%", isGreen: true },
              { ticker: "DRIFT-PERP", price: "$0.5621", change: "+4.18%", isGreen: true },
              { ticker: "WIF-PERP", price: "$2.1550", change: "-5.40%", isGreen: false }
            ].map((mover, idx) => (
              <div key={`mover-${idx}`} className="flex space-x-1.5">
                <span className="text-zinc-400 font-bold">{mover.ticker}</span>
                <span className="text-white font-mono">{mover.price}</span>
                <span className={`font-mono font-bold ${mover.isGreen ? "text-[#00c087]" : "text-[#ff3b30]"}`}>
                  ({mover.change})
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-4 shrink-0 font-mono text-zinc-500 font-bold">
          <div className="flex items-center space-x-1.5">
            <span>Hourly Yield</span>
            <span className="text-white">$0.00</span>
          </div>
        </div>
      </footer>

      <AuthModal />

      <ConfirmModal
        open={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        onConfirm={() => {
          logout();
          setLogoutConfirmOpen(false);
        }}
        title="Log out"
        description="You are about to sign out of your account. You'll need to log in again to place trades or manage your portfolio."
        confirmLabel="Log out"
        variant="danger"
        icon={<LogOut className="h-6 w-6 text-white" />}
        details={user ? [{ label: "Account", value: user.username }] : undefined}
      />
    </div>
  );
}
