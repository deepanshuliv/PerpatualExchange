'use client';

import { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';

const CLOSE_DELAY_MS = 150;

/**
 * Avatar button with an account popover.
 * Hover previews the popover; clicking pins it open until you click outside or press Escape.
 */
export default function AccountMenu({ email, onLogout }: { email: string; onLogout: () => void }) {
  const [hovering, setHovering] = useState(false);
  const [pinned, setPinned] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const open = hovering || pinned;

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  const close = () => {
    cancelClose();
    setHovering(false);
    setPinned(false);
  };

  useEffect(() => {
    if (!pinned) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pinned]);

  useEffect(() => cancelClose, []);

  const initial = (email.slice(0, 1) || '?').toUpperCase();

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        setHovering(true);
      }}
      onMouseLeave={() => {
        cancelClose();
        closeTimer.current = setTimeout(() => setHovering(false), CLOSE_DELAY_MS);
      }}
    >
      <button
        type="button"
        onClick={() => setPinned((p) => !p)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account"
        className={`flex h-8 w-8 items-center justify-center rounded-full border text-[13px] font-semibold transition-colors ${
          open ? 'border-subtle bg-hover text-fg' : 'border-line-strong bg-raised text-fg hover:border-subtle'
        }`}
      >
        {initial}
      </button>

      {open && (
        // pt-2 bridges the gap so moving the cursor from the button into the popover keeps it open.
        <div className="absolute right-0 top-full z-50 pt-2">
          <div
            role="menu"
            className="anim-fade-in w-64 overflow-hidden rounded-lg border border-line-strong bg-raised shadow-xl shadow-black/50"
          >
            <div className="flex items-center gap-3 px-3.5 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-hover text-sm font-semibold text-fg">
                {initial}
              </span>
              <div className="min-w-0">
                <div className="text-[11px] text-subtle">Signed in as</div>
                <div className="truncate text-[13px] text-fg" title={email}>
                  {email}
                </div>
              </div>
            </div>
            <div className="border-t border-line p-1">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  onLogout();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] text-muted transition-colors hover:bg-down/10 hover:text-down"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
