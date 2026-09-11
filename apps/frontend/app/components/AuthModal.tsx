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
      <div className="relative w-full max-w-[400px] bg-[#0B0E11] border border-[#2B2F36] rounded-xl p-6 flex flex-col shadow-2xl text-white">
        <button
          onClick={() => setAuthModalMode(null)}
          className="absolute top-4 right-4 text-[#848E9C] hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col mb-6">
          <h2 className="text-xl font-bold text-white tracking-wide">
            {isLogin ? 'Log in' : 'Create account'}
          </h2>
        </div>

        {error && (
          <div className="w-full text-xs py-3 px-4 rounded-lg mb-4" style={{ color: '#F23645', backgroundColor: 'rgba(255, 77, 79, 0.1)', border: '1px solid #3A1C1C' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="w-full flex flex-col space-y-4">
          <div className="flex flex-col space-y-1.5 w-full">
            <span className="text-xs text-[#848E9C] font-semibold">Email</span>
            <input
              type="text"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#161A1E] border border-[#2B2F36] focus:border-[#14F195] focus:outline-none rounded-lg p-3 text-sm text-white font-semibold transition-colors placeholder:text-[#848E9C]"
            />
          </div>

          <div className="flex flex-col space-y-1.5 w-full relative">
            <span className="text-xs text-[#848E9C] font-semibold">Password</span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#161A1E] border border-[#2B2F36] focus:border-[#14F195] focus:outline-none rounded-lg p-3 pr-11 text-sm text-white font-semibold transition-colors placeholder:text-[#848E9C]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#848E9C] hover:text-white"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div className="flex items-center space-x-1.5 w-full">
              {[1, 2, 3, 4, 5].map((index) => {
                const isActive = strength >= index;
                return (
                  <div
                    key={`strength-${index}`}
                    className={`h-1 flex-1 rounded-sm transition-colors ${
                      isActive
                        ? strength <= 2
                          ? 'bg-[#F23645]'
                          : strength <= 4
                            ? 'bg-yellow-500'
                            : 'bg-[#14F195]'
                        : 'bg-[#2B2F36]'
                    }`}
                  />
                );
              })}
            </div>
          )}

          {!isLogin && (
            <div className="flex flex-col space-y-1.5 w-full relative">
              <span className="text-xs text-[#848E9C] font-semibold">Confirm Password</span>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#161A1E] border border-[#2B2F36] focus:border-[#14F195] focus:outline-none rounded-lg p-3 pr-11 text-sm text-white font-semibold transition-colors placeholder:text-[#848E9C]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#848E9C] hover:text-white"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {!isLogin && (
            <label className="flex items-start space-x-2 text-[11px] text-[#848E9C] font-semibold cursor-pointer select-none leading-relaxed mt-1">
              <input
                type="checkbox"
                checked={agree}
                onChange={() => setAgree(!agree)}
                className="w-3.5 h-3.5 rounded border-[#2B2F36] bg-[#161A1E] accent-[#14F195] outline-none cursor-pointer mt-0.5"
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
            className={`w-full py-3.5 rounded-lg font-bold text-sm shadow-sm transition-colors mt-2 ${
              isLogin
                ? 'bg-white text-black hover:bg-zinc-200'
                : 'bg-[#14F195] text-black hover:bg-[#12d886]'
            } disabled:opacity-50 cursor-pointer`}
          >
            {loading ? 'Processing...' : isLogin ? 'Log in' : 'Sign up'}
          </button>
        </form>

        <div className="w-full flex items-center justify-between mt-6 text-xs font-semibold pt-4 border-t border-[#2B2F36]">
          {isLogin ? (
            <>
              <span className="text-[#848E9C]">
                New here?{' '}
                <button
                  onClick={() => setAuthModalMode('signup')}
                  className="text-white hover:underline"
                >
                  Sign up
                </button>
              </span>
              <button className="text-[#848E9C] hover:text-white hover:underline">Forgot Password</button>
            </>
          ) : (
            <>
              <span className="text-[#848E9C]">
                Have an account?{' '}
                <button
                  onClick={() => setAuthModalMode('login')}
                  className="text-white hover:underline"
                >
                  Log in
                </button>
              </span>
              <button className="text-[#848E9C] hover:text-white hover:underline">Add referral</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
