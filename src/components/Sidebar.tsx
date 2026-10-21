import {
  Boxes,
  LayoutDashboard,
  ArrowDownUp,
  PackageCheck,
  FileSpreadsheet,
  BarChart3,
  RefreshCw,
  ExternalLink,
  LogOut,
  CheckCircle2,
  Users,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  Truck,
  ShieldCheck,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { SpreadsheetConfig, UserAccount } from '../types/inventory.js';
import { isMenuAllowed } from '../utils/inventory.js';

interface SidebarProps {
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

export const Sidebar: React.FC<SidebarProps> = ({
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
  const rawNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'master', label: 'Stock List', icon: PackageCheck },
    { id: 'customers', label: 'Database Customer', icon: Users },
    { id: 'suppliers', label: 'Database Supplier', icon: Truck },
    { id: 'history', label: 'Riwayat Mutasi', icon: FileSpreadsheet },
    { id: 'reports', label: 'Laporan', icon: BarChart3 },
    { id: 'accounts', label: 'Database Akun', icon: ShieldCheck },
  ];

  const navItems = rawNavItems.filter((item) => isMenuAllowed(activeUser, item.id));

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col shrink-0 min-h-screen border-r border-slate-800 shadow-xl">
      {/* Brand Logo & Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 shrink-0">
          <Boxes className="w-6 h-6" />
        </div>
        <div className="overflow-hidden">
          <div className="flex items-center space-x-1.5">
            <span className="font-extrabold text-lg tracking-tight text-white">Global Mart</span>
            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
              API
            </span>
          </div>
          <p className="text-[11px] text-slate-400 truncate">Sistem Keluar Masuk Barang</p>
        </div>
      </div>

      {/* Navigation Menu (Vertical Left) */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto" aria-label="Sidebar Navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          if (item.id === 'history') {
            return (
              <div key={item.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('history');
                    if (setHistoryFilter) setHistoryFilter('ALL');
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 ring-1 ring-emerald-500/50'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isActive ? 'rotate-180' : 'opacity-60'}`} />
                </button>

                {/* Submenu Pilihan Mutasi Barang Masuk & Barang Keluar */}
                <div className="pl-6 pr-1 py-1 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('history');
                      if (setHistoryFilter) setHistoryFilter('ALL');
                    }}
                    className={`w-full flex items-center space-x-2 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                      isActive && historyFilter === 'ALL'
                        ? 'bg-slate-700/80 text-white border border-slate-600'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                    <span>Semua Mutasi</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('history');
                      if (setHistoryFilter) setHistoryFilter('IN');
                    }}
                    className={`w-full flex items-center space-x-2 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                      isActive && historyFilter === 'IN'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'text-slate-400 hover:text-emerald-300 hover:bg-slate-800/50'
                    }`}
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>History Pembelian</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('history');
                      if (setHistoryFilter) setHistoryFilter('OUT');
                    }}
                    className={`w-full flex items-center space-x-2 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                      isActive && historyFilter === 'OUT'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'text-slate-400 hover:text-rose-300 hover:bg-slate-800/50'
                    }`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>History Penjualan</span>
                  </button>
                </div>
              </div>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 ring-1 ring-emerald-500/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Google Sheets Status & Integration Section */}
      {activeUser?.username === 'server' && (
        <div className="p-4 mx-3 mb-4 bg-slate-800/60 rounded-2xl border border-slate-700/60 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Google Sheets</span>
            {spreadsheetConfig?.spreadsheetId ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Terhubung"></span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-400" title="Belum Terhubung"></span>
            )}
          </div>

          {spreadsheetConfig?.spreadsheetId ? (
            <div className="space-y-2">
              <p className="text-xs font-bold text-white truncate" title={spreadsheetConfig.spreadsheetTitle}>
                {spreadsheetConfig.spreadsheetTitle || 'Spreadsheet Aktif'}
              </p>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onQuickSync}
                  disabled={isSyncing}
                  className="flex-1 flex items-center justify-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 px-2 rounded-xl text-[11px] font-bold transition-colors shadow-xs"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Sinkron</span>
                </button>
                <a
                  href={spreadsheetConfig.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Buka Spreadsheet di tab baru"
                  className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-200 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenSpreadsheetModal}
              className="w-full flex items-center justify-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-3 rounded-xl text-xs font-bold transition-colors shadow-sm"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Hubungkan Sheets</span>
            </button>
          )}
        </div>
      )}

      {/* User Account Footer Section (Sheet AKUN & Google) */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-2">
        {activeUser ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0">
                {activeUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden text-left text-xs">
                <div className="flex items-center space-x-1.5">
                  <p className="font-bold text-white truncate leading-tight">
                    {activeUser.name}
                  </p>
                </div>
                <div className="flex items-center space-x-1 mt-0.5">
                  <span className="text-[10px] text-slate-400 font-mono truncate">
                    @{activeUser.username}
                  </span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/30 uppercase">
                    {activeUser.role}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onLogoutAccount}
              title="Ganti / Keluar Akun Pengguna"
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenLoginModal}
            className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 px-3 rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Masuk Akun (Sheet AKUN)</span>
          </button>
        )}

        {/* Google Sync Status */}
        {user ? (
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center space-x-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
              <span className="truncate" title={user.email || ''}>Sheets: {user.email?.split('@')[0]}</span>
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="text-slate-500 hover:text-slate-300 text-[10px]"
              title="Putus Google Auth"
            >
              Putus
            </button>
          </div>
        ) : onLogin && (
          <button
            type="button"
            onClick={onLogin}
            className="w-full flex items-center justify-center space-x-1.5 bg-slate-800/80 hover:bg-slate-800 text-slate-300 py-1.5 px-2.5 rounded-lg text-[11px] font-semibold transition-colors"
          >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
            </svg>
            <span>Hubungkan Google</span>
          </button>
        )}
      </div>
    </aside>
  );
};
