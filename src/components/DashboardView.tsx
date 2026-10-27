import React, { useState, useMemo } from 'react';
import {
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  FileSpreadsheet,
  Search,
  ExternalLink,
  RefreshCw,
  Eye,
} from 'lucide-react';
import type { Item, Transaction, StockSummary, SpreadsheetConfig, UserAccount } from '../types/inventory.js';
import { formatNumber, getStockGudang, getStockPiranha, getStockToko, hasPermission } from '../utils/inventory.js';
import { SkuDetailModal } from './SkuDetailModal.js';

interface DashboardViewProps {
  items: Item[];
  transactions?: Transaction[];
  summary?: StockSummary;
  spreadsheetConfig?: SpreadsheetConfig | null;
  activeUser?: UserAccount | null;
  onOpenTransactionModal: (type: 'IN' | 'OUT', preselectedItemId?: string) => void;
  onOpenAddItemModal?: () => void;
  onOpenSpreadsheetModal?: () => void;
  onViewAllHistory?: () => void;
  onViewAllMaster?: () => void;
  onQuickSync?: () => void;
  isSyncing?: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  items,
  spreadsheetConfig,
  activeUser,
  onOpenTransactionModal,
  onOpenSpreadsheetModal,
  onQuickSync,
  isSyncing = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDetailItem, setSelectedDetailItem] = useState<Item | null>(null);

  // Filter items by SKU code or Name
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.sku.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  // Aggregate totals for the warehouse stock columns: Gudang, Piranha, Toko, Total
  const totalGudang = useMemo(() => {
    return filteredItems.reduce((acc, item) => acc + getStockGudang(item), 0);
  }, [filteredItems]);

  const totalPiranha = useMemo(() => {
    return filteredItems.reduce((acc, item) => acc + getStockPiranha(item), 0);
  }, [filteredItems]);

  const totalToko = useMemo(() => {
    return filteredItems.reduce((acc, item) => acc + getStockToko(item), 0);
  }, [filteredItems]);

  const totalKeseluruhan = useMemo(() => {
    return filteredItems.reduce((acc, item) => acc + item.currentStock, 0);
  }, [filteredItems]);

  const isServerUser = activeUser?.username?.trim().toLowerCase() === 'server';

  return (
    <div className="space-y-6">
      {/* Top Banner: Navigation & Quick Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 sm:p-7 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-0.5 rounded-full text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Dashboard Stok SKU</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Manajemen Stok GLOBAL MART
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm">
              Detail pemantauan stok fisik per SKU di Gudang, Piranha, dan Toko.
            </p>
          </div>

          {/* Action Buttons: Barang Masuk & Penjualan (Guarded by permissions) */}
          <div className="flex flex-wrap items-center gap-3">
            {hasPermission(activeUser, 'history_in', 'add') && (
              <button
                onClick={() => onOpenTransactionModal('IN')}
                className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>Barang Masuk</span>
              </button>
            )}

            {hasPermission(activeUser, 'history_out', 'add') && (
              <button
                onClick={() => onOpenTransactionModal('OUT')}
                className="flex items-center space-x-2 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-rose-500/25 transition-all cursor-pointer"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Penjualan</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Bar inside Banner (Strictly ONLY for server account) */}
        {isServerUser && (
          <div className="relative z-10 mt-5 pt-4 border-t border-slate-700/60 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-3">
            <div className="flex items-center space-x-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
              {spreadsheetConfig?.spreadsheetId ? (
                <span>
                  Database Aktif:{' '}
                  <strong className="text-white">{spreadsheetConfig.spreadsheetTitle}</strong>
                  {spreadsheetConfig.lastSyncedAt && ` (Sinkronisasi: ${spreadsheetConfig.lastSyncedAt})`}
                </span>
              ) : (
                <span className="text-amber-300">
                  Spreadsheet belum terhubung. Data sementara tersimpan lokal.
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {spreadsheetConfig?.spreadsheetId ? (
                <>
                  <button
                    onClick={onQuickSync}
                    disabled={isSyncing}
                    className="inline-flex items-center space-x-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-xs font-semibold"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan'}</span>
                  </button>
                  <a
                    href={spreadsheetConfig.spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 px-2.5 py-1 text-emerald-300 hover:text-emerald-200"
                  >
                    <span>Buka Sheet</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </>
              ) : onOpenSpreadsheetModal ? (
                <button
                  onClick={onOpenSpreadsheetModal}
                  className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold transition-colors cursor-pointer"
                >
                  Hubungkan Google Sheets
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Detail SKU Barang Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 shadow-2xs">
              <Boxes className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Detail SKU Barang
              </h2>
              <p className="text-xs text-slate-500">
                Menampilkan rincian stok Gudang, Piranha, Toko, dan Total Stok per SKU
              </p>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px] sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Cari kode SKU atau nama barang..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* The Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/90 text-slate-700 font-bold uppercase tracking-wider text-[11px] sm:text-xs border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Kode SKU</th>
                <th className="px-5 py-3.5">Nama Barang</th>
                <th className="px-4 py-3.5 text-center bg-indigo-50/60 text-indigo-900 border-x border-indigo-100">
                  Stok Gudang
                </th>
                <th className="px-4 py-3.5 text-center bg-cyan-50/60 text-cyan-900 border-r border-cyan-100">
                  Stok Piranha
                </th>
                <th className="px-4 py-3.5 text-center bg-amber-50/60 text-amber-900 border-r border-amber-100">
                  Stok Toko
                </th>
                <th className="px-5 py-3.5 text-center bg-emerald-50/60 text-emerald-950 font-black">
                  Total Keseluruhan Stok
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    <Boxes className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-700 text-sm">Tidak ada SKU barang yang cocok</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Silakan periksa kata kunci pencarian SKU atau nama barang.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const stockGudang = getStockGudang(item);
                  const stockPiranha = getStockPiranha(item);
                  const stockToko = getStockToko(item);
                  const totalStock = stockGudang + stockPiranha + stockToko;

                  return (
                    <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                      {/* 1. Kode SKU */}
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedDetailItem(item)}
                          className="bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 px-2.5 py-1 rounded-lg border border-slate-200/80 transition-all flex items-center space-x-1.5 cursor-pointer group/sku shadow-2xs"
                          title="Klik untuk melihat detail lengkap sesuai sheet 'STOCK LIST'"
                        >
                          <span>{item.sku}</span>
                          <Eye className="w-3.5 h-3.5 text-slate-400 group-hover/sku:text-indigo-600 transition-colors" />
                        </button>
                      </td>

                      {/* 2. Nama Barang */}
                      <td className="px-5 py-3.5 font-bold text-slate-900">
                        <button
                          type="button"
                          onClick={() => setSelectedDetailItem(item)}
                          className="text-left font-bold text-slate-900 hover:text-indigo-600 transition-colors cursor-pointer group/name block"
                          title="Klik untuk melihat detail SKU"
                        >
                          <span className="group-hover/name:underline">{item.name}</span>
                        </button>
                      </td>

                      {/* 3. Stok Gudang */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap bg-indigo-50/20 border-x border-indigo-100/50">
                        <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-black bg-indigo-50 text-indigo-900 border border-indigo-200">
                          {formatNumber(stockGudang)} {item.unit}
                        </span>
                      </td>

                      {/* 4. Stok Piranha */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap bg-cyan-50/20 border-r border-cyan-100/50">
                        <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-black bg-cyan-50 text-cyan-900 border border-cyan-200">
                          {formatNumber(stockPiranha)} {item.unit}
                        </span>
                      </td>

                      {/* 5. Stok Toko */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap bg-amber-50/20 border-r border-amber-100/50">
                        <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-black bg-amber-50 text-amber-900 border border-amber-200">
                          {formatNumber(stockToko)} {item.unit}
                        </span>
                      </td>

                      {/* 6. Total Kuantiti */}
                      <td className="px-5 py-3.5 text-center whitespace-nowrap bg-emerald-50/20">
                        <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                          {formatNumber(totalStock)} {item.unit}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SkuDetailModal (Data sesuai Sheet 'STOCK LIST') */}
      <SkuDetailModal
        item={selectedDetailItem}
        isOpen={!!selectedDetailItem}
        onClose={() => setSelectedDetailItem(null)}
        onOpenTransaction={onOpenTransactionModal}
        activeUser={activeUser}
      />
    </div>
  );
};
