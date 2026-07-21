'use client';

import { Eye, EyeOff, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTrading } from '../context/TradingContext';

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

  useEffect(() => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setAgree(false);
    setError('');
  }, [authModalMode]);

  if (!authModalMode) return null;

  const isLogin = authModalMode === 'login';

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

    if (!email.trim() || !password) {
      setError('Please fill out all fields.');
      return;
    }

    if (!isLogin) {
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
      <div className="relative w-full max-w-[400px] bg-[#12161c] border border-[#1d222b] rounded-2xl p-8 flex flex-col items-center shadow-2xl text-[#f2f4f7]">
        <button
          onClick={() => setAuthModalMode(null)}
          className="absolute top-4 right-4 text-[#8491a5] hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center mb-6">
          <div className="bg-[#ff3b30] p-3.5 rounded-[18px] flex items-center justify-center shadow-lg shadow-[#ff3b30]/10 mb-4">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white tracking-wide">
            {isLogin ? 'Log in' : 'Create account'}
          </h2>
        </div>

        {error && (
          <div className="w-full text-center text-xs text-red-400 bg-red-500/10 border border-red-500/20 py-2.5 px-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="w-full flex flex-col space-y-4">
          <div className="flex flex-col space-y-1.5 w-full">
            <input
              type="text"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0c0d10] border border-[#171a1f] focus:border-blue-500 focus:outline-none rounded-xl p-3.5 text-sm text-white font-semibold transition-colors placeholder:text-zinc-600"
            />
          </div>

          <div className="flex flex-col space-y-1.5 w-full relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0c0d10] border border-[#171a1f] focus:border-blue-500 focus:outline-none rounded-xl p-3.5 pr-11 text-sm text-white font-semibold transition-colors placeholder:text-zinc-600"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {!isLogin && (
            <div className="flex items-center space-x-1.5 w-full px-1">
              {[1, 2, 3, 4, 5].map((index) => {
                const isActive = strength >= index;
                return (
                  <div
                    key={`strength-${index}`}
                    className={`h-1 flex-1 rounded-sm transition-colors ${
                      isActive
                        ? strength <= 2
                          ? 'bg-red-500'
                          : strength <= 4
                            ? 'bg-yellow-500'
                            : 'bg-[#00c087]'
                        : 'bg-[#1d222b]'
                    }`}
                  />
                );
              })}
            </div>
          )}

          {!isLogin && (
            <div className="flex flex-col space-y-1.5 w-full relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#0c0d10] border border-[#171a1f] focus:border-blue-500 focus:outline-none rounded-xl p-3.5 pr-11 text-sm text-white font-semibold transition-colors placeholder:text-zinc-600"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          )}

          {!isLogin && (
            <label className="flex items-start space-x-2 text-[10px] text-[#8491a5] font-semibold cursor-pointer select-none leading-relaxed mt-1 px-1">
              <input
                type="checkbox"
                checked={agree}
                onChange={() => setAgree(!agree)}
                className="w-3.5 h-3.5 rounded border-[#171a1f] bg-[#08090b] accent-blue-500 outline-none cursor-pointer mt-0.5"
              />
              <span>
                By signing up, I agree to the{' '}
                <span className="text-blue-400 hover:underline">User Agreement</span> and{' '}
                <span className="text-blue-400 hover:underline">Privacy Policy</span>.
              </span>
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3.5 rounded-xl font-bold text-xs shadow-sm transition-colors mt-2 ${
              isLogin
                ? 'bg-white text-black hover:bg-zinc-200'
                : 'bg-[#dbdee6] text-[#12161c] hover:bg-[#cdd1dc]'
            } disabled:opacity-50 cursor-pointer`}
          >
            {loading ? 'Processing...' : isLogin ? 'Log in' : 'Sign up'}
          </button>
        </form>

        <div className="w-full flex items-center justify-between mt-6 text-[11px] font-semibold border-t border-[#1d222b] pt-4 px-1">
          {isLogin ? (
            <>
              <span className="text-[#8491a5]">
                New here?{' '}
                <button
                  onClick={() => setAuthModalMode('signup')}
                  className="text-blue-400 hover:underline"
                >
                  Sign up
                </button>
              </span>
              <button className="text-blue-400 hover:underline">Forgot Password</button>
            </>
          ) : (
            <>
              <span className="text-[#8491a5]">
                Have an account?{' '}
                <button
                  onClick={() => setAuthModalMode('login')}
                  className="text-blue-400 hover:underline"
                >
                  Log in
                </button>
              </span>
              <button className="text-purple-400 hover:underline">Add referral</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
