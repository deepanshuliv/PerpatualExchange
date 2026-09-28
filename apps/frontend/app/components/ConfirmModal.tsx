"use client";

import React, { useEffect } from "react";
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
  error?: string;
}

const variantStyles: Record<ConfirmVariant, { icon: string; confirmBtn: string }> = {
  danger: {
    icon: "bg-down/10 text-down",
    confirmBtn: "bg-down text-canvas hover:brightness-110",
  },
  default: {
    icon: "bg-raised text-fg",
    confirmBtn: "bg-fg text-canvas hover:bg-white",
  },
  success: {
    icon: "bg-up/10 text-up",
    confirmBtn: "bg-up text-canvas hover:brightness-110",
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
  error,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  const styles = variantStyles[variant];

  return (
    <div
      className="anim-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 font-sans backdrop-blur-[2px] select-none"
      onClick={loading ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="anim-dialog-in relative flex w-full max-w-[380px] flex-col rounded-xl border border-line-strong bg-surface p-5 text-fg shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          disabled={loading}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-md p-1.5 text-subtle transition-colors hover:bg-raised hover:text-fg disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 flex items-start gap-3 pr-8">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${styles.icon}`}>
            {icon}
          </div>
          <div className="flex flex-col gap-1 pt-0.5">
            <h2 id="confirm-modal-title" className="text-[15px] font-semibold tracking-tight">
              {title}
            </h2>
            <p className="text-[13px] leading-relaxed text-muted">{description}</p>
          </div>
        </div>

        {details && details.length > 0 && (
          <dl className="mb-5 divide-y divide-line rounded-lg border border-line bg-canvas/40 px-3.5">
            {details.map((detail) => (
              <div key={detail.label} className="flex min-h-10 items-center justify-between gap-4 py-2 text-[13px]">
                <dt className="text-muted">{detail.label}</dt>
                {detail.input ? (
                  <dd className="flex h-8 items-center gap-1 rounded-md border border-line-strong bg-raised px-2 transition-colors focus-within:border-subtle">
                    {detail.input.prefix && (
                      <span className="font-mono text-xs text-subtle">{detail.input.prefix}</span>
                    )}
                    <input
                      type="text"
                      inputMode="decimal"
                      autoFocus
                      value={detail.input.value}
                      onChange={(e) => detail.input!.onChange(e.target.value)}
                      placeholder={detail.input.placeholder}
                      disabled={loading}
                      className="w-24 bg-transparent text-right font-mono text-[13px] text-fg outline-none disabled:opacity-50"
                    />
                  </dd>
                ) : (
                  <dd className="truncate font-mono text-xs text-fg">{detail.value}</dd>
                )}
              </div>
            ))}
          </dl>
        )}

        {error && (
          <p role="alert" className="mb-4 rounded-md border border-down/20 bg-down/10 px-3 py-2 text-xs text-down">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="h-9 flex-1 rounded-md border border-line-strong text-[13px] font-medium text-fg transition-colors hover:bg-raised disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || confirmDisabled}
            className={`h-9 flex-1 rounded-md text-[13px] font-semibold transition-[filter,background-color,transform] active:scale-[0.99] disabled:opacity-50 ${styles.confirmBtn}`}
          >
            {loading ? "Processing…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
