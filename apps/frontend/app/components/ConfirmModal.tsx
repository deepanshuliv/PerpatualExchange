"use client";

import React from "react";
import { X } from "lucide-react";

export type ConfirmVariant = "danger" | "default" | "success";

export interface ConfirmDetail {
  label: string;
  value?: string;
  input?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    prefix?: string;
  };
}

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  loading?: boolean;
  confirmDisabled?: boolean;
  icon: React.ReactNode;
  details?: ConfirmDetail[];
}

const variantStyles: Record<
  ConfirmVariant,
  { iconBg: string; iconShadow: string; confirmBtn: string }
> = {
  danger: {
    iconBg: "bg-[#ff3b30]",
    iconShadow: "shadow-[#ff3b30]/10",
    confirmBtn:
      "bg-[#ff3b30] text-white hover:bg-[#e6352b] border border-[#ff3b30]/20",
  },
  default: {
    iconBg: "bg-[#171a1f]",
    iconShadow: "shadow-black/20",
    confirmBtn:
      "bg-white text-black hover:bg-zinc-200 border border-white/10",
  },
  success: {
    iconBg: "bg-[#00c087]",
    iconShadow: "shadow-[#00c087]/10",
    confirmBtn:
      "bg-[#00c087] text-black hover:bg-[#00a876] border border-[#00c087]/20",
  },
};

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  confirmDisabled = false,
  icon,
  details,
}: ConfirmModalProps) {
  if (!open) return null;

  const styles = variantStyles[variant];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans select-none"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[380px] bg-[#12161c] border border-[#1d222b] rounded-2xl p-7 flex flex-col shadow-2xl text-[#f2f4f7]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 text-[#8491a5] hover:text-white transition-colors disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center mb-5">
          <div
            className={`${styles.iconBg} p-3 rounded-[16px] flex items-center justify-center shadow-lg ${styles.iconShadow} mb-4`}
          >
            {icon}
          </div>
          <h2 className="text-lg font-bold text-white tracking-wide">{title}</h2>
          <p className="text-xs text-[#8491a5] mt-2 leading-relaxed max-w-[280px]">
            {description}
          </p>
        </div>

        {details && details.length > 0 && (
          <div className="w-full bg-[#0c0d10] border border-[#171a1f] rounded-xl p-3.5 mb-5 space-y-2">
            {details.map((detail) => (
              <div
                key={detail.label}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-[#8491a5] font-semibold">{detail.label}</span>
                {detail.input ? (
                  <div className="flex items-center gap-1">
                    {detail.input.prefix && (
                      <span className="text-[#8491a5] font-mono">{detail.input.prefix}</span>
                    )}
                    <input
                      type="text"
                      inputMode="decimal"
                      value={detail.input.value}
                      onChange={(e) => detail.input!.onChange(e.target.value)}
                      placeholder={detail.input.placeholder}
                      disabled={loading}
                      className="w-28 text-right text-white font-bold font-mono bg-[#171a1f] border border-[#242b35] rounded-lg px-2 py-1 focus:outline-none focus:border-[#00c087] disabled:opacity-50"
                    />
                  </div>
                ) : (
                  <span className="text-white font-bold font-mono">{detail.value}</span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center space-x-3 w-full">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 rounded-xl font-bold text-xs bg-[#171a1f] text-[#8491a5] hover:text-white hover:bg-[#1c222b] border border-[#242b35] transition-colors disabled:opacity-50 cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || confirmDisabled}
            className={`flex-1 py-3 rounded-xl font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer ${styles.confirmBtn}`}
          >
            {loading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
