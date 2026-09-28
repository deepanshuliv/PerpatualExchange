'use client';

import { Eye, EyeOff, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTrading } from '../context/TradingContext';

const PASSWORD_MIN_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputBox =
  'flex h-10 items-center gap-2 rounded-md border border-line bg-raised px-3 transition-colors focus-within:border-subtle hover:border-line-strong';
const inputEl = 'w-full min-w-0 bg-transparent text-sm text-fg outline-none placeholder:text-subtle';

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: 'current-password' | 'new-password';
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">{label}</span>
      <span className={inputBox}>
        <input
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputEl}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="shrink-0 text-subtle transition-colors hover:text-fg"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
    </label>
  );
}

function passwordStrength(password: string) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

function StrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const strength = passwordStrength(password);
  const color = strength <= 2 ? 'bg-down' : strength <= 4 ? 'bg-warn' : 'bg-up';
  const label = strength <= 2 ? 'Weak' : strength <= 4 ? 'Fair' : 'Strong';
  return (
    <span className="-mt-2 flex items-center gap-2">
      <span className="flex flex-1 gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${strength >= i ? color : 'bg-raised'}`} />
        ))}
      </span>
      <span className="w-11 text-right text-[11px] text-subtle">{label}</span>
    </span>
  );
}

export default function AuthModal({ onAuthenticated }: { onAuthenticated?: () => void } = {}) {
  const { authModalMode, setAuthModalMode, login, signup, resetPassword } = useTrading();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  // Carried across the switch from "reset password" back to "log in".
  const carryRef = useRef<{ email: string; notice: string } | null>(null);

  useEffect(() => {
    const carry = carryRef.current;
    carryRef.current = null;
    setEmail(carry?.email ?? '');
    setNotice(carry?.notice ?? '');
    setPassword('');
    setConfirmPassword('');
    setAgree(false);
    setError('');
  }, [authModalMode]);

  useEffect(() => {
    if (!authModalMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAuthModalMode(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [authModalMode, setAuthModalMode]);

  if (!authModalMode) return null;

  const isLogin = authModalMode === 'login';
  const isSignup = authModalMode === 'signup';
  const isReset = authModalMode === 'forgot_password';

  const validate = (): string | null => {
    const trimmed = email.trim();
    if (!trimmed) return 'Enter your email.';
    if (!EMAIL_PATTERN.test(trimmed)) return 'Enter a valid email address.';
    if (!password) return isLogin ? 'Enter your password.' : 'Enter a new password.';
    if (!isLogin && password.length < PASSWORD_MIN_LENGTH) {
      return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
    }
    if (!isLogin && password !== confirmPassword) return 'Passwords do not match.';
    if (isSignup && !agree) return 'Please accept the User Agreement and Privacy Policy.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    setLoading(true);
    try {
      if (isReset) {
        const result = await resetPassword(normalizedEmail, password);
        if (!result.ok) {
          setError(result.msg ?? 'Could not reset your password.');
          return;
        }
        carryRef.current = { email: normalizedEmail, notice: 'Password updated. Log in with your new password.' };
        setAuthModalMode('login');
        return;
      }

      const result = isLogin ? await login(normalizedEmail, password) : await signup(normalizedEmail, password);
      if (result.ok) {
        setAuthModalMode(null);
        onAuthenticated?.();
      } else {
        setError(result.msg ?? 'Something went wrong. Please try again.');
      }
    } catch (err) {
      console.log('[AuthModal] error', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const title = isLogin ? 'Log in to Axiom' : isReset ? 'Reset your password' : 'Create your account';
  const subtitle = isLogin
    ? 'Welcome back. Enter your details to continue.'
    : isReset
      ? 'Choose a new password for your account.'
      : 'Start trading perpetuals in under a minute.';
  const submitLabel = isLogin ? 'Log in' : isReset ? 'Update password' : 'Create account';

  return (
    <div
      className="anim-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 font-sans backdrop-blur-[2px]"
      onClick={() => setAuthModalMode(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="anim-dialog-in relative flex w-full max-w-[400px] flex-col rounded-xl border border-line-strong bg-surface p-6 text-fg shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setAuthModalMode(null)}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-md p-1.5 text-subtle transition-colors hover:bg-raised hover:text-fg"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-6 flex flex-col gap-1">
          <img src="/logo.jpg" alt="" className="mb-3 h-8 w-8 rounded-md border border-line-strong object-cover" />
          <h2 id="auth-modal-title" className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <p className="text-[13px] text-muted">{subtitle}</p>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-md border border-down/20 bg-down/10 px-3 py-2 text-xs text-down">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mb-4 rounded-md border border-up/20 bg-up/10 px-3 py-2 text-xs text-up">
            {notice}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate className="flex w-full flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">Email</span>
            <span className={inputBox}>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputEl}
              />
            </span>
          </label>

          <PasswordField
            label={isLogin ? 'Password' : 'New password'}
            value={password}
            onChange={setPassword}
            placeholder={isLogin ? 'Enter your password' : `At least ${PASSWORD_MIN_LENGTH} characters`}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
          />
          {!isLogin && <StrengthMeter password={password} />}

          {!isLogin && (
            <PasswordField
              label="Confirm password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Repeat your password"
              autoComplete="new-password"
            />
          )}

          {isSignup && (
            <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-muted select-none">
              <input
                type="checkbox"
                checked={agree}
                onChange={() => setAgree(!agree)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-[var(--up)]"
              />
              <span>
                I agree to the <span className="text-fg">User Agreement</span> and{' '}
                <span className="text-fg">Privacy Policy</span>.
              </span>
            </label>
          )}

          {isLogin && (
            <button
              type="button"
              onClick={() => {
                carryRef.current = { email: email.trim(), notice: '' };
                setAuthModalMode('forgot_password');
              }}
              className="-mt-1 self-end text-xs text-muted transition-colors hover:text-fg"
            >
              Forgot password?
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 h-10 w-full rounded-md bg-fg text-[13px] font-semibold text-canvas transition-[background-color,transform] hover:bg-white active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? 'Please wait…' : submitLabel}
          </button>
        </form>

        <p className="mt-5 border-t border-line pt-4 text-center text-xs text-muted">
          {isLogin ? "Don't have an account? " : isReset ? 'Remembered it? ' : 'Already have an account? '}
          <button
            onClick={() => setAuthModalMode(isLogin ? 'signup' : 'login')}
            className="font-medium text-fg transition-colors hover:text-white"
          >
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  );
}
