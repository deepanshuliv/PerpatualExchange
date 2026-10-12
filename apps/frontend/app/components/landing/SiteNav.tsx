'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useMotionValueEvent, useScroll } from 'motion/react';
import { ArrowRight, LogOut } from 'lucide-react';
import { useTrading } from '../../context/TradingContext';
import AccountMenu from '../AccountMenu';
import ConfirmModal from '../ConfirmModal';

const LINKS = [
  { href: '/markets', label: 'Markets' },
  { href: '/#features', label: 'Features' },
  { href: '/#architecture', label: 'Architecture' },
];

/** Top navigation shared by the landing and markets pages. */
export default function SiteNav() {
  const pathname = usePathname();
  const { user, logout, setAuthModalMode } = useTrading();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 12));

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color] duration-300 ${
          scrolled
            ? 'border-b border-line bg-canvas/75 backdrop-blur-xl'
            : 'border-b border-transparent'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Axiom home">
            <img
              src="/logo.jpg"
              alt=""
              className="h-7 w-7 rounded-md border border-line-strong object-cover"
            />
            <span className="text-[15px] font-semibold tracking-tight">Axiom</span>
          </Link>

          <nav className="hidden items-center gap-8 text-[13px] md:flex">
            {LINKS.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? 'page' : undefined}
                  className={`transition-colors ${active ? 'text-fg' : 'text-muted hover:text-fg'}`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <AccountMenu
                email={user.email}
                onLogout={() => setLogoutConfirmOpen(true)}
                onChangePassword={() => setAuthModalMode('change_password')}
              />
            ) : (
              <button
                onClick={() => setAuthModalMode('login')}
                className="h-9 rounded-full px-4 text-[13px] font-medium text-muted transition-colors hover:text-fg"
              >
                Log in
              </button>
            )}
            {pathname !== '/markets' && (
              <Link
                href="/markets"
                className="group flex h-9 items-center gap-1.5 rounded-full bg-fg px-4 text-[13px] font-semibold text-canvas transition-[background-color,transform] hover:bg-white active:scale-[0.97]"
              >
                Start trading
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Rendered outside <header>: its backdrop-filter would trap a fixed-position dialog. */}
      <ConfirmModal
        open={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        onConfirm={() => {
          logout();
          setLogoutConfirmOpen(false);
        }}
        title="Log out"
        description="You'll need to log in again to place trades or manage positions."
        confirmLabel="Log out"
        variant="danger"
        icon={<LogOut className="h-5 w-5" />}
        details={user ? [{ label: 'Account', value: user.email }] : undefined}
      />
    </>
  );
}
