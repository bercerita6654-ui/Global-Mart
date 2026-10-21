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
import type { UserAccount } from '../types/inventory.js';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: UserAccount[];
  activeUser: UserAccount | null;
  onLoginAccount: (account: UserAccount) => void;
  onLoginGoogle?: () => void;
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
  onRefreshAccountsFromSheet,
  isSyncingAccounts = false,
  googleUserEmail,
}) => {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'credentials' | 'google'>('credentials');

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
    if (onLoginGoogle) {
      try {
        onLoginGoogle();
      } catch (err) {
        console.warn('Auto google login trigger notice:', err);
      }
    }
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

  const roleColor = (role: string) => {
    switch (role) {
      case 'Admin':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Supervisor':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Kasir':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Sales':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      default:
        return 'bg-amber-100 text-amber-800 border-amber-300';
    }
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
            <h3 id="login-modal-title" className="text-base font-bold text-white">
              Masuk Akun Pengguna
            </h3>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-semibold">{errorMsg}</span>
              </div>
            )}

            {/* Username */}
            <div>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="Username"
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
              <span>Login</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Accounts List */}
          {accounts.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Pilih Akun Cepat (Demo / Akses Cepat):
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

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500">
          <span>Sistem Inventaris Global Mart (Protected)</span>
        </div>
      </div>
    </div>
  );
};
