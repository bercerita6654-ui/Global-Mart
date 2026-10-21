import React, { useState } from 'react';
import {
  X,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileSpreadsheet,
  ShieldCheck,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { UserAccount } from '../types/inventory.js';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: UserAccount[];
  activeUser: UserAccount | null;
  onLoginAccount: (account: UserAccount) => void;
  onLoginGoogle?: () => Promise<void> | void;
  user?: User | null;
  onRefreshAccountsFromSheet?: () => Promise<void>;
  isSyncingAccounts?: boolean;
  googleUserEmail?: string | null;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  accounts,
  activeUser,
  onLoginAccount,
  onLoginGoogle,
  user,
  onRefreshAccountsFromSheet,
  isSyncingAccounts = false,
  googleUserEmail,
}) => {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const query = usernameOrEmail.trim().toLowerCase();
    const pass = password.trim();

    if (!query) {
      setErrorMsg('Masukkan username atau email akun Anda.');
      return;
    }

    if (!pass) {
      setErrorMsg('Masukkan kata sandi / password akun Anda.');
      return;
    }

    // Find account in accounts list (from sheet AKUN)
    const matchedAccount = accounts.find((acc) => {
      const uMatch = acc.username.trim().toLowerCase() === query;
      const eMatch = acc.email ? acc.email.trim().toLowerCase() === query : false;
      const nMatch = acc.name.trim().toLowerCase() === query;
      return uMatch || eMatch || nMatch;
    });

    if (!matchedAccount) {
      setErrorMsg(
        `Akun "${usernameOrEmail}" tidak ditemukan di database sheet "AKUN". Pastikan username sesuai atau klik tombol demo di bawah.`
      );
      return;
    }

    if (matchedAccount.status === 'Nonaktif') {
      setErrorMsg(`Akun "${matchedAccount.name}" saat ini berstatus NONAKTIF. Hubungi Admin untuk aktivasi.`);
      return;
    }

    // If account has password, verify it
    if (matchedAccount.password && matchedAccount.password.trim() !== '' && matchedAccount.password !== '-') {
      if (matchedAccount.password.trim() !== pass) {
        setErrorMsg('Kata sandi / password yang Anda masukkan salah. Silakan coba lagi.');
        return;
      }
    }

    // Success login
    onLoginAccount(matchedAccount);
    onClose();
  };

  const handleQuickLogin = (acc: UserAccount) => {
    if (acc.status === 'Nonaktif') {
      setErrorMsg(`Akun "${acc.name}" saat ini berstatus Nonaktif.`);
      return;
    }
    onLoginAccount(acc);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 bg-emerald-600 text-white rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <h3 id="login-modal-title" className="text-base font-bold text-white">
                Masuk Sistem Inventaris
              </h3>
              <p className="text-xs text-slate-300">
                {!user ? 'Langkah 1: Autentikasi Google' : 'Langkah 2: Masukkan Kredensial Akun'}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          {!user ? (
            <div className="py-6 text-center space-y-5">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl mx-auto flex items-center justify-center shadow-lg shadow-emerald-600/10">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h4 className="text-base font-extrabold text-slate-900">Masuk dengan Akun Google Terlebih Dahulu</h4>
                <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                  Silakan masuk menggunakan akun Google Anda di bagian depan untuk mengaktifkan sinkronisasi database Google Spreadsheet secara aman.
                </p>
              </div>

              <button
                type="button"
                onClick={async () => {
                  if (onLoginGoogle) {
                    try {
                      await onLoginGoogle();
                    } catch (err: any) {
                      setErrorMsg(err?.message || 'Gagal login Google.');
                    }
                  }
                }}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-2xl text-sm font-bold shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center space-x-2.5 cursor-pointer"
              >
                <svg className="w-5 h-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Masuk dengan Google</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-bold text-emerald-900 truncate" title={user.email || ''}>
                    Google Terhubung: {user.email || user.displayName}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                  Langkah 2 / 2
                </span>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Username */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Username / Email Akun
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      placeholder="cth: admin, server, kasir1"
                      value={usernameOrEmail}
                      onChange={(e) => {
                        setUsernameOrEmail(e.target.value);
                        setErrorMsg('');
                      }}
                      className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Password Akun
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrorMsg('');
                      }}
                      className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Login Submit Button */}
                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <span>Masuk Aplikasi</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Quick Demo Accounts List */}
              {accounts.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Atau Pilih Akun Cepat (Akses Cepat):
                  </p>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                    {accounts.map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => handleQuickLogin(acc)}
                        className="flex flex-col items-start p-2.5 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 rounded-xl text-left transition-all group cursor-pointer"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold text-slate-900 group-hover:text-emerald-800 truncate">
                            {acc.name}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-black bg-slate-200 text-slate-700 group-hover:bg-emerald-200 group-hover:text-emerald-900 uppercase">
                            {acc.role}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 group-hover:text-emerald-700 mt-0.5">
                          @{acc.username} {acc.password ? `(${acc.password})` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
