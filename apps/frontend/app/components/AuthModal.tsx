'use client';

import { Eye, EyeOff, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTrading } from '../context/TradingContext';

const BP = {
  bg: '#0B0E11',
  border: '#2B2F36',
  inputBg: '#161A1E',
  muted: '#848E9C',
  green: '#14F195',
  red: '#F23645',
  errorBg: 'rgba(255, 77, 79, 0.1)',
  errorBorder: '#3A1C1C',
} as const;

export default function AuthModal() {
  const { authModalMode, setAuthModalMode, login, signup } = useTrading();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agree, setAgree] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setAgree(false);
    setError('');
    setResetSuccess(false);
  }, [authModalMode]);

  if (!authModalMode) return null;

  const isLogin = authModalMode === 'login';
  const isSignup = authModalMode === 'signup';
  const isForgotPassword = authModalMode === 'forgot_password';

  const getPasswordStrength = () => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 6) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  };

  const strength = getPasswordStrength();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetSuccess(false);

    if (isForgotPassword) {
      if (!email.trim()) {
        setError('Please enter your email.');
        return;
      }
      setLoading(true);
      setTimeout(() => {
        setResetSuccess(true);
        setLoading(false);
      }, 800);
      return;
    }

    if (!email.trim() || !password) {
      setError('Please fill out all fields.');
      return;
    }

    if (isSignup) {
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (!agree) {
        setError('You must agree to the User Agreement and Privacy Policy.');
        return;
      }
    }

    setLoading(true);
    try {
      let success = false;
      if (isLogin) {
        success = await login(email.trim(), password);
      } else {
        success = await signup(email.trim(), password);
      }

      if (success) {
        setAuthModalMode(null);
      } else {
        setError(isLogin ? 'Invalid credentials.' : 'Username already exists.');
      }
    } catch (err) {
      console.log('[handleAuth] error', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans select-none">
      <div
        className="relative w-full max-w-[400px] rounded-xl p-6 flex flex-col shadow-2xl text-white"
        style={{ backgroundColor: BP.bg, border: `1px solid ${BP.border}` }}
      >
        <button
          onClick={() => setAuthModalMode(null)}
          className="absolute top-4 right-4 hover:text-white transition-colors"
          style={{ color: BP.muted }}
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col mb-6">
          <h2 className="text-xl font-bold text-white tracking-wide">
            {isLogin ? 'Log in' : isForgotPassword ? 'Reset Password' : 'Create account'}
          </h2>
        </div>

        {error && (
          <div
            className="w-full text-xs py-3 px-4 rounded-lg mb-4"
            style={{
              color: BP.red,
              backgroundColor: BP.errorBg,
              border: `1px solid ${BP.errorBorder}`,
            }}
          >
            {error}
          </div>
        )}

        {isForgotPassword && resetSuccess && (
          <div
            className="w-full text-xs py-3 px-4 rounded-lg mb-4"
            style={{
              color: BP.green,
              backgroundColor: 'rgba(20, 241, 149, 0.1)',
              border: '1px solid rgba(20, 241, 149, 0.2)',
            }}
          >
            Password reset to: DummyPassword123!
          </div>
        )}

        <form onSubmit={handleAuth} className="w-full flex flex-col gap-4">
          <div
            className="rounded-lg p-4 flex flex-col gap-2"
            style={{ backgroundColor: BP.inputBg }}
          >
            <span className="text-xs" style={{ color: BP.muted }}>
              Email
            </span>
            <div className="flex items-center justify-between gap-3">
              <input
                type="text"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:font-normal placeholder:opacity-50"
              />
            </div>
          </div>

          {!isForgotPassword && (
            <div
              className="rounded-lg p-4 flex flex-col gap-2 relative"
              style={{ backgroundColor: BP.inputBg }}
            >
              <span className="text-xs" style={{ color: BP.muted }}>
                Password
              </span>
              <div className="flex items-center justify-between gap-3">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:font-normal placeholder:opacity-50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 hover:text-white"
                  style={{ color: BP.muted }}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {isSignup && (
            <div className="flex items-center gap-1.5 w-full">
              {[1, 2, 3, 4, 5].map((index) => {
                const isActive = strength >= index;
                return (
                  <div
                    key={`strength-${index}`}
                    className="h-1 flex-1 rounded-sm transition-colors"
                    style={{
                      backgroundColor: isActive
                        ? strength <= 2
                          ? BP.red
                          : strength <= 4
                            ? '#eab308' // yellow-500
                            : BP.green
                        : BP.border,
                    }}
                  />
                );
              })}
            </div>
          )}

          {isSignup && (
            <div
              className="rounded-lg p-4 flex flex-col gap-2 relative"
              style={{ backgroundColor: BP.inputBg }}
            >
              <span className="text-xs" style={{ color: BP.muted }}>
                Confirm Password
              </span>
              <div className="flex items-center justify-between gap-3">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:font-normal placeholder:opacity-50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 hover:text-white"
                  style={{ color: BP.muted }}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          {isSignup && (
            <label
              className="flex items-start gap-2 text-[11px] font-semibold cursor-pointer select-none leading-relaxed mt-1"
              style={{ color: BP.muted }}
            >
              <input
                type="checkbox"
                checked={agree}
                onChange={() => setAgree(!agree)}
                className="w-3.5 h-3.5 rounded outline-none cursor-pointer mt-0.5"
                style={{
                  backgroundColor: BP.inputBg,
                  border: `1px solid ${BP.border}`,
                  accentColor: BP.green,
                }}
              />
              <span>
                By signing up, I agree to the{' '}
                <span className="text-white hover:underline">User Agreement</span> and{' '}
                <span className="text-white hover:underline">Privacy Policy</span>.
              </span>
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-lg font-bold text-sm transition-all cursor-pointer disabled:opacity-50 mt-2 hover:opacity-90"
            style={{ backgroundColor: '#FFFFFF', color: '#000000' }}
          >
            {loading
              ? 'Processing...'
              : isLogin
                ? 'Log in'
                : isForgotPassword
                  ? 'Reset Password'
                  : 'Sign up'}
          </button>
        </form>

        <div
          className="w-full flex items-center justify-between mt-6 text-xs font-semibold pt-4"
          style={{ borderTop: `1px solid ${BP.border}` }}
        >
          {isForgotPassword ? (
            <span style={{ color: BP.muted }}>
              Remember your password?{' '}
              <button
                onClick={() => setAuthModalMode('login')}
                className="text-white hover:underline"
              >
                Log in
              </button>
            </span>
          ) : isLogin ? (
            <>
              <span style={{ color: BP.muted }}>
                New here?{' '}
                <button
                  onClick={() => setAuthModalMode('signup')}
                  className="text-white hover:underline"
                >
                  Sign up
                </button>
              </span>
              <button
                onClick={() => setAuthModalMode('forgot_password')}
                className="hover:text-white hover:underline"
                style={{ color: BP.muted }}
              >
                Forgot Password
              </button>
            </>
          ) : (
            <>
              <span style={{ color: BP.muted }}>
                Have an account?{' '}
                <button
                  onClick={() => setAuthModalMode('login')}
                  className="text-white hover:underline"
                >
                  Log in
                </button>
              </span>
              <button className="hover:text-white hover:underline" style={{ color: BP.muted }}>
                Add referral
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
