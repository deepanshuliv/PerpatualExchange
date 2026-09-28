import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { TradingProvider } from "./context/TradingContext";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Axiom — Perpetual Futures",
  description: "Trade BTC, ETH and SOL perpetual futures with up to 75x leverage on a low-latency order book.",
  icons: { icon: "/logo.jpg" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // dir is set explicitly because some browser extensions inject it before hydration;
    // suppressHydrationWarning only covers this element's own attributes, not its children.
    <html
      lang="en"
      dir="ltr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <TradingProvider>
          {children}
        </TradingProvider>
      </body>
    </html>
  );
}
