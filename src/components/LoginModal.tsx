import React, { useState } from 'react';
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, User } from 'lucide-react';
import { StoreLogo } from './StoreLogo.js';

interface LoginModalProps {
  onLogin: (credentials: { username: string; password: string }) => Promise<void>;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setErrorMsg('Harap masukkan username dan kata sandi.');
      return;
    }

    try {
      setSubmitting(true);
      await onLogin({ username: cleanUsername, password: cleanPassword });
    } catch (err: any) {
      setErrorMsg(err.message || 'Username atau kata sandi tidak sesuai.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Header Branding */}
        <div className="p-6 border-b border-slate-100 text-center flex flex-col items-center">
          <div className="mb-3">
            <StoreLogo size="lg" />
          </div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight">
            Toko Sembako Berkah Mandiri
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Sistem Informasi Manajemen Persediaan & Kasir Penjualan
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full py-2.5 pl-9 pr-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 font-medium text-slate-900 placeholder:text-slate-400"
                  placeholder="Masukkan username akun Anda"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Kata Sandi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full py-2.5 pl-9 pr-10 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 font-medium text-slate-900 placeholder:text-slate-400"
                  placeholder="Masukkan kata sandi akun Anda"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Sembunyikan sandi' : 'Lihat sandi'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !username.trim() || !password.trim()}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              <span>{submitting ? 'Memverifikasi...' : 'Masuk ke Sistem'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Clean Professional Footer */}
        <div className="py-3 px-6 bg-slate-50 border-t border-slate-100 text-center text-[10px] text-slate-400">
          Sistem Informasi Manajemen Persediaan Sembako & Kasir Terintegrasi
        </div>
      </div>
    </div>
  );
};
