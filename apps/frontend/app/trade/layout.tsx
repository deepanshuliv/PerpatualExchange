import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trade · Axiom",
  description: "Live BTC, ETH and SOL perpetual futures order books, charts and order entry.",
};

export default function TradeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
