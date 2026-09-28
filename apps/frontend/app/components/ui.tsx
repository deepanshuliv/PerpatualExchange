"use client";

import type { ReactNode } from "react";

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-line bg-surface select-none ${className}`}
    >
      {children}
    </section>
  );
}

interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
}

/** Underline tabs used in every panel header. */
export function PanelTabs<T extends string>({
  tabs,
  active,
  onChange,
  right,
}: {
  tabs: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  right?: ReactNode;
}) {
  return (
    <div className="flex h-10 shrink-0 items-stretch justify-between gap-3 border-b border-line px-3">
      <div role="tablist" className="no-scrollbar flex min-w-0 items-stretch gap-4 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`relative flex shrink-0 items-center gap-1.5 text-[13px] font-medium transition-colors ${
                isActive ? "text-fg" : "text-muted hover:text-fg"
              }`}
            >
              {tab.label}
              <span
                className={`absolute inset-x-0 -bottom-px h-px transition-colors ${isActive ? "bg-fg" : "bg-transparent"}`}
              />
            </button>
          );
        })}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

/** Compact segmented control for small option sets (intervals, price source…). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "sm",
}: {
  options: { id: T; label: ReactNode; title?: string }[];
  value: T;
  onChange: (id: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex items-center rounded-md bg-raised p-0.5">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          title={opt.title}
          aria-pressed={value === opt.id}
          onClick={() => onChange(opt.id)}
          className={`rounded-[5px] font-medium transition-colors ${
            size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs"
          } ${value === opt.id ? "bg-hover text-fg shadow-sm" : "text-muted hover:text-fg"}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex h-full min-h-28 flex-col items-center justify-center gap-1 px-4 text-center font-sans">
      <span className="text-[13px] text-muted">{title}</span>
      {hint && <span className="text-xs text-subtle">{hint}</span>}
    </div>
  );
}

const MARKET_META: Record<string, { glyph: string; bg: string; fg: string }> = {
  BTCUSD: { glyph: "₿", bg: "#f7931a", fg: "#fff" },
  ETHUSD: { glyph: "Ξ", bg: "#627eea", fg: "#fff" },
  SOLUSD: { glyph: "S", bg: "#1f2937", fg: "#14f195" },
};

export function MarketIcon({ market, size = 20 }: { market: string; size?: number }) {
  const meta = MARKET_META[market] ?? MARKET_META.BTCUSD!;
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.52),
        background: meta.bg,
        color: meta.fg,
      }}
    >
      {meta.glyph}
    </span>
  );
}

export function SideTag({ long }: { long: boolean }) {
  return (
    <span className={`font-sans text-xs font-medium ${long ? "text-up" : "text-down"}`}>
      {long ? "Long" : "Short"}
    </span>
  );
}
