"use client";

import React from "react";
import { X } from "lucide-react";

type ConfirmVariant = "danger" | "default" | "success";

interface ConfirmDetail {
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
    iconBg: "bg-[#F23645]",
    iconShadow: "shadow-[#F23645]/10",
    confirmBtn:
      "bg-[#F23645] text-white hover:bg-[#d42d38] border border-transparent",
  },
  default: {
    iconBg: "bg-[#161A1E]",
    iconShadow: "shadow-black/20",
    confirmBtn:
      "bg-white text-black hover:bg-zinc-200 border border-transparent",
  },
  success: {
    iconBg: "bg-[#14F195]",
    iconShadow: "shadow-[#14F195]/10",
    confirmBtn:
      "bg-[#14F195] text-black hover:bg-[#12d886] border border-transparent",
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
        className="relative w-full max-w-[380px] bg-[#0B0E11] border border-[#2B2F36] rounded-xl p-6 flex flex-col shadow-2xl text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 text-[#848E9C] hover:text-white transition-colors disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center mb-5 mt-2">
          <div
            className={`${styles.iconBg} p-3 rounded-xl flex items-center justify-center shadow-lg ${styles.iconShadow} mb-4 text-white ${variant === 'success' ? 'text-black' : ''}`}
          >
            {icon}
          </div>
          <h2 className="text-lg font-bold text-white tracking-wide">{title}</h2>
          <p className="text-xs text-[#848E9C] mt-2 leading-relaxed max-w-[280px]">
            {description}
          </p>
        </div>

        {details && details.length > 0 && (
          <div className="w-full bg-[#161A1E] border border-[#2B2F36] rounded-lg p-4 mb-6 space-y-3">
            {details.map((detail) => (
              <div
                key={detail.label}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-[#848E9C] font-semibold">{detail.label}</span>
                {detail.input ? (
                  <div className="flex items-center gap-1">
                    {detail.input.prefix && (
                      <span className="text-[#848E9C] font-mono">{detail.input.prefix}</span>
                    )}
                    <input
                      type="text"
                      inputMode="decimal"
                      value={detail.input.value}
                      onChange={(e) => detail.input!.onChange(e.target.value)}
                      placeholder={detail.input.placeholder}
                      disabled={loading}
                      className="w-28 text-right text-white font-bold font-mono bg-[#0B0E11] border border-[#2B2F36] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#14F195] disabled:opacity-50"
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
            className="flex-1 py-3 rounded-lg font-bold text-xs bg-[#161A1E] text-[#848E9C] hover:text-white hover:bg-[#2B2F36] border border-[#2B2F36] transition-colors disabled:opacity-50 cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || confirmDisabled}
            className={`flex-1 py-3 rounded-lg font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer ${styles.confirmBtn}`}
          >
            {loading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
