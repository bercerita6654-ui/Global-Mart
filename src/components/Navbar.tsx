import React from 'react';
import {
  Boxes,
  LayoutDashboard,
  ArrowDownUp,
  PackageCheck,
  FileSpreadsheet,
  BarChart3,
  RefreshCw,
  ExternalLink,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Users,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { SpreadsheetConfig, UserAccount } from '../types/inventory.js';

interface NavbarProps {
  activeTab: 'dashboard' | 'master' | 'history' | 'reports' | 'customers' | 'suppliers' | 'accounts';
  setActiveTab: (tab: 'dashboard' | 'master' | 'history' | 'reports' | 'customers' | 'suppliers' | 'accounts') => void;
  historyFilter?: 'ALL' | 'IN' | 'OUT';
  setHistoryFilter?: (filter: 'ALL' | 'IN' | 'OUT') => void;
  user: User | null;
  activeUser?: UserAccount | null;
  spreadsheetConfig: SpreadsheetConfig | null;
  isSyncing: boolean;
  onOpenSpreadsheetModal: () => void;
  onOpenLoginModal?: () => void;
  onQuickSync: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onLogoutAccount?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  historyFilter = 'ALL',
  setHistoryFilter,
  user,
  activeUser,
  spreadsheetConfig,
  isSyncing,
  onOpenSpreadsheetModal,
  onOpenLoginModal,
  onQuickSync,
  onLogin,
  onLogout,
  onLogoutAccount,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand and Navigation Tabs */}
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                <Boxes className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-xl tracking-tight text-slate-900">Global Mart</span>
                  <span className="bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-semibold border border-emerald-200">
                    Sheets API
                  </span>
                </div>
                <p className="text-xs text-slate-600 hidden xl:block">Sistem Keluar Masuk Barang Real-time</p>
              </div>
            </div>

            {/* Navigation Tabs (Moved to Left) */}
            <nav className="hidden md:flex items-center space-x-1" aria-label="Main Navigation">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs lg:text-sm font-semibold transition-all ${
                  activeTab === 'dashboard'
                    ? 'bg-emerald-50 text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span>Dashboard</span>
              </button>

              <button
                onClick={() => setActiveTab('master')}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs lg:text-sm font-semibold transition-all ${
                  activeTab === 'master'
                    ? 'bg-emerald-50 text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <PackageCheck className="w-4 h-4 shrink-0" />
                <span>Master Data Barang</span>
              </button>

              <button
                onClick={() => setActiveTab('customers')}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs lg:text-sm font-semibold transition-all ${
                  activeTab === 'customers'
                    ? 'bg-emerald-50 text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Database Customer</span>
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs lg:text-sm font-semibold transition-all ${
                  activeTab === 'history'
                    ? 'bg-emerald-50 text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span>Riwayat Mutasi</span>
              </button>

              <button
                onClick={() => setActiveTab('reports')}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs lg:text-sm font-semibold transition-all ${
                  activeTab === 'reports'
                    ? 'bg-emerald-50 text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <BarChart3 className="w-4 h-4 shrink-0" />
                <span>Laporan</span>
              </button>
            </nav>
          </div>

          {/* Right Actions: Sheets Status & Google Account */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {activeUser?.username === 'server' && (
              spreadsheetConfig?.spreadsheetId ? (
                <div className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200/80 rounded-xl px-2.5 py-1.5 text-xs text-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="font-semibold max-w-[120px] truncate hidden sm:inline" title={spreadsheetConfig.spreadsheetTitle}>
                    {spreadsheetConfig.spreadsheetTitle || 'Terhubung'}
                  </span>
                  <button
                    type="button"
                    onClick={onQuickSync}
                    disabled={isSyncing}
                    title="Sinkronkan data sekarang ke Google Sheets"
                    className="p-1 hover:bg-emerald-100 rounded text-emerald-700 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  </button>
                  <a
                    href={spreadsheetConfig.spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Buka Google Sheets di tab baru"
                    className="p-1 hover:bg-emerald-100 rounded text-emerald-700 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onOpenSpreadsheetModal}
                  className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Hubungkan Sheets</span>
                  <span className="sm:hidden">Sheets</span>
                </button>
              )
            )}

            {/* Active User Account from Sheet AKUN */}
            {activeUser ? (
              <div className="flex items-center space-x-2 border-l border-slate-200 pl-2 sm:pl-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0">
                  {activeUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden lg:block text-left text-xs">
                  <div className="flex items-center space-x-1.5">
                    <p className="font-extrabold text-slate-900 leading-tight truncate max-w-[110px]">
                      {activeUser.name}
                    </p>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-black border uppercase ${
                        activeUser.role === 'Admin'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-blue-50 text-blue-800 border-blue-300'
                      }`}
                    >
                      {activeUser.role}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono truncate max-w-[110px]">
                    @{activeUser.username}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onLogoutAccount}
                  title="Ganti / Keluar Akun Pengguna"
                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenLoginModal}
                className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Masuk Akun</span>
              </button>
            )}

            {/* Google Account Status (optional secondary indicator) */}
            {user ? (
              <div className="hidden xl:flex items-center space-x-1.5 text-[11px] text-slate-500 pl-2 border-l border-slate-200" title={`Google: ${user.email}`}>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="truncate max-w-[90px]">{user.email?.split('@')[0]}</span>
              </div>
            ) : onLogin && (
              <button
                type="button"
                onClick={onLogin}
                title="Hubungkan Akun Google untuk Izin Simpan Otomatis ke Spreadsheet"
                className="hidden xl:flex items-center space-x-1 text-[11px] text-slate-500 hover:text-slate-800 px-2 py-1 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <span>Google</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Sub-Navigation Bar */}
        <div className="flex md:hidden overflow-x-auto py-2 space-x-2 border-t border-slate-100 scrollbar-none">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
              activeTab === 'dashboard' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('master')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
              activeTab === 'master' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            Master Data Barang
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
              activeTab === 'customers' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            Database Customer
          </button>
          <div className="flex items-center space-x-1 shrink-0">
            <button
              onClick={() => {
                setActiveTab('history');
                if (setHistoryFilter) setHistoryFilter('ALL');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                activeTab === 'history' && historyFilter === 'ALL'
                  ? 'bg-emerald-600 text-white'
                  : activeTab === 'history'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              Riwayat Mutasi
            </button>
            {activeTab === 'history' && (
              <>
                <button
                  onClick={() => setHistoryFilter && setHistoryFilter('IN')}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold ${
                    historyFilter === 'IN' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-800'
                  }`}
                >
                  Masuk
                </button>
                <button
                  onClick={() => setHistoryFilter && setHistoryFilter('OUT')}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold ${
                    historyFilter === 'OUT' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-800'
                  }`}
                >
                  Keluar
                </button>
              </>
            )}
          </div>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
              activeTab === 'reports' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            Laporan
          </button>
        </div>
      </div>
    </header>
  );
};
