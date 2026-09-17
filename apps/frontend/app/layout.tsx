import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Axiom | High-Performance Perpetual Exchange",
  description: "Axiom - Next-generation low-latency cryptocurrency perpetual exchange.",
};

import { TradingProvider } from "./context/TradingContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <TradingProvider>
          {children}
        </TradingProvider>
      </body>
    </html>
  );
}
