import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Printer,
  Calendar,
  Layers,
  TrendingUp,
  Package,
  Building,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  Search,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Item, Transaction, StockSummary } from '../types/inventory.js';
import { formatRupiah, formatNumber } from '../utils/inventory.js';

interface ReportsViewProps {
  items: Item[];
  transactions: Transaction[];
  summary: StockSummary;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ items, transactions, summary }) => {
  // Date filters: Support specific start date, end date, or quick month
  const now = new Date();
  const currentMonthStr = now.toISOString().slice(0, 7); // YYYY-MM
  const firstDayOfMonth = `${currentMonthStr}-01`;
  const todayStr = now.toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState<string>(firstDayOfMonth);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [searchSku, setSearchSku] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SAFE' | 'LOW' | 'OUT'>('ALL');

  // Filter transactions based on date range
  const periodTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (startDate && t.date < startDate) return false;
      if (endDate && t.date > endDate) return false;
      return true;
    });
  }, [transactions, startDate, endDate]);

  // Aggregate stats per SKU
  const skuReports = useMemo(() => {
    return items.map((item) => {
      const itemTx = periodTransactions.filter((t) => t.itemId === item.id || t.sku === item.sku);

      let inQty = 0;
      let inValue = 0;
      let outQty = 0;
      let outValue = 0;

      for (const tx of itemTx) {
        if (tx.type === 'IN') {
          inQty += tx.quantity;
          inValue += tx.totalPrice;
        } else if (tx.type === 'OUT') {
          outQty += tx.quantity;
          outValue += tx.totalPrice;
        }
      }

      // Also compute lifetime total sales for this SKU
      const lifetimeOutTx = transactions.filter(
        (t) => (t.itemId === item.id || t.sku === item.sku) && t.type === 'OUT'
      );
      const lifetimeSalesQty = lifetimeOutTx.reduce((sum, t) => sum + t.quantity, 0);
      const lifetimeSalesAmount = lifetimeOutTx.reduce((sum, t) => sum + t.totalPrice, 0);

      const costPrice = item.costPrice ?? item.unitPrice ?? 0;
      const totalValuation = item.currentStock * costPrice;
      const isOut = item.currentStock === 0;
      const isLow = !isOut && item.currentStock <= item.minStock;

      return {
        item,
        costPrice,
        totalValuation,
        periodInQty: inQty,
        periodInValue: inValue,
        periodOutQty: outQty,
        periodOutValue: outValue,
        lifetimeSalesQty,
        lifetimeSalesAmount,
        isOut,
        isLow,
        isSafe: !isOut && !isLow,
      };
    });
  }, [items, periodTransactions, transactions]);

  // Filter by search query and stock status
  const filteredSkuReports = useMemo(() => {
    return skuReports.filter((r) => {
      const q = searchSku.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.item.sku.toLowerCase().includes(q) ||
        r.item.name.toLowerCase().includes(q) ||
        r.item.category.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (statusFilter === 'OUT' && !r.isOut) return false;
      if (statusFilter === 'LOW' && !r.isLow) return false;
      if (statusFilter === 'SAFE' && !r.isSafe) return false;

      return true;
    });
  }, [skuReports, searchSku, statusFilter]);

  // Summary Metrics for the Report
  const totalPhysicalStock = filteredSkuReports.reduce((acc, r) => acc + r.item.currentStock, 0);
  const totalValuationValue = filteredSkuReports.reduce((acc, r) => acc + r.totalValuation, 0);
  const totalPeriodInQty = filteredSkuReports.reduce((acc, r) => acc + r.periodInQty, 0);
  const totalPeriodInValue = filteredSkuReports.reduce((acc, r) => acc + r.periodInValue, 0);
  const totalPeriodOutQty = filteredSkuReports.reduce((acc, r) => acc + r.periodOutQty, 0);
  const totalPeriodOutValue = filteredSkuReports.reduce((acc, r) => acc + r.periodOutValue, 0);
  const totalLifetimeSales = filteredSkuReports.reduce((acc, r) => acc + r.lifetimeSalesAmount, 0);

  // Top Outbound Items (Fast Moving) by SKU
  const fastMovingSkus = useMemo(() => {
    return [...skuReports]
      .filter((r) => r.periodOutQty > 0)
      .sort((a, b) => b.periodOutQty - a.periodOutQty)
      .slice(0, 5);
  }, [skuReports]);

  // Export to Excel
  const handleExportExcel = () => {
    const dataToExport = filteredSkuReports.map((r, idx) => ({
      No: idx + 1,
      'Kode SKU': r.item.sku,
      'Nama Barang': r.item.name,
      Kategori: r.item.category,
      'Sisa Stok Fisik': r.item.currentStock,
      Satuan: r.item.unit,
      'Harga Modal Satuan': r.costPrice,
      'Total Nilai Valuasi Modal': r.totalValuation,
      'Pembelian Masuk (Qty)': r.periodInQty,
      'Nilai Pembelian (Rp)': r.periodInValue,
      'Penjualan Keluar (Qty)': r.periodOutQty,
      'Nilai Penjualan Periode Ini (Rp)': r.periodOutValue,
      'Total Penjualan Keseluruhan (Rp)': r.lifetimeSalesAmount,
      'Status Stok': r.isOut ? 'HABIS (0)' : r.isLow ? 'MENIPIS' : 'AMAN',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan SKU Inventaris');
    XLSX.writeFile(
      workbook,
      `laporan_inventaris_sku_${startDate || 'awal'}_sd_${endDate || 'akhir'}.xlsx`
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <Boxes className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              Laporan Inventaris Berdasarkan SKU Barang
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Rekapitulasi sisa stok fisik, nilai modal, transaksi pembelian masuk, dan perputaran penjualan per masing-masing SKU barang.
          </p>
        </div>

        {/* Action Buttons: Export to Excel & Print */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportExcel}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-white" />
            <span>Export to Excel</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / Simpan PDF</span>
          </button>
        </div>
      </div>

      {/* Date Filter & Preset Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center space-x-1 font-bold text-slate-700">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>Filter Periode Tanggal:</span>
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
            <span className="text-slate-400">s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />

            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => {
                  setStartDate(`${currentMonthStr}-01`);
                  setEndDate(todayStr);
                }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 30);
                  setStartDate(d.toISOString().slice(0, 10));
                  setEndDate(todayStr);
                }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                30 Hari Terakhir
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Semua Waktu
              </button>
            </div>
          </div>

          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari SKU atau nama barang..."
              value={searchSku}
              onChange={(e) => setSearchSku(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Status Filter Badges */}
        <div className="flex items-center space-x-2 pt-2 border-t border-slate-100 text-xs font-semibold text-slate-600">
          <span className="text-[11px] text-slate-400">Filter Status:</span>
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg transition-colors ${
              statusFilter === 'ALL' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 hover:bg-slate-200'
            }`}
          >
            Semua SKU ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('SAFE')}
            className={`px-2.5 py-1 rounded-lg transition-colors ${
              statusFilter === 'SAFE' ? 'bg-emerald-600 text-white font-bold' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            Stok Aman
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('LOW')}
            className={`px-2.5 py-1 rounded-lg transition-colors ${
              statusFilter === 'LOW' ? 'bg-amber-600 text-white font-bold' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            Menipis ({summary.lowStockItemsCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('OUT')}
            className={`px-2.5 py-1 rounded-lg transition-colors ${
              statusFilter === 'OUT' ? 'bg-rose-600 text-white font-bold' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            Habis ({summary.outOfStockItemsCount})
          </button>
        </div>
      </div>

      {/* 3 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Total Sisa Stok Fisik
          </span>
          <p className="text-2xl font-extrabold text-slate-900">{formatNumber(totalPhysicalStock)} unit</p>
          <p className="text-xs text-slate-500 mt-1">Dari {filteredSkuReports.length} SKU terdaftar</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Pembelian Masuk (Periode)
          </span>
          <p className="text-2xl font-extrabold text-emerald-600">+{formatNumber(totalPeriodInQty)} unit</p>
          <p className="text-xs text-slate-500 mt-1">Nilai: {formatRupiah(totalPeriodInValue)}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Penjualan Keluar (Periode)
          </span>
          <p className="text-2xl font-extrabold text-rose-600">-{formatNumber(totalPeriodOutQty)} unit</p>
          <p className="text-xs text-slate-500 mt-1">Omzet: {formatRupiah(totalPeriodOutValue)}</p>
        </div>
      </div>

      {/* Main Table: Laporan Inventaris Berdasarkan SKU Barang */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Tabel Laporan Inventaris Per SKU Barang
            </h2>
            <p className="text-xs text-slate-500">
              Data terperinci sisa stok, modal, mutasi masuk, dan penjualan per kode SKU
            </p>
          </div>
          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
            Menampilkan {filteredSkuReports.length} SKU
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 text-center">No</th>
                <th className="px-4 py-3">Kode SKU</th>
                <th className="px-4 py-3">Nama Barang & Kategori</th>
                <th className="px-3 py-3 text-center">Sisa Stok Fisik</th>
                <th className="px-4 py-3 text-right">Harga Modal</th>
                <th className="px-3 py-3 text-center text-emerald-700 bg-emerald-50/50">
                  Masuk (Periode)
                </th>
                <th className="px-3 py-3 text-center text-rose-700 bg-rose-50/50">
                  Keluar / Terjual
                </th>
                <th className="px-4 py-3 text-right text-emerald-900 bg-emerald-50/30">
                  Total Penjualan (Rp)
                </th>
                <th className="px-3 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSkuReports.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-500">
                    <Boxes className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">Tidak ada SKU barang yang cocok</p>
                    <p className="text-xs">Coba sesuaikan pencarian atau reset filter tanggal.</p>
                  </td>
                </tr>
              ) : (
                filteredSkuReports.map((r, idx) => (
                  <tr key={r.item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3 py-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {r.item.sku}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">{r.item.name}</p>
                      <p className="text-[11px] text-slate-500">{r.item.category}</p>
                    </td>
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      <span className="font-extrabold text-slate-900 text-sm">
                        {formatNumber(r.item.currentStock)} {r.item.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-slate-700 whitespace-nowrap">
                      {formatRupiah(r.costPrice)}
                    </td>
                    <td className="px-3 py-3 text-center whitespace-nowrap bg-emerald-50/20 font-bold text-emerald-700">
                      {r.periodInQty > 0 ? `+${formatNumber(r.periodInQty)} ${r.item.unit}` : '-'}
                      {r.periodInValue > 0 && (
                        <p className="text-[10px] text-emerald-600 font-normal">
                          {formatRupiah(r.periodInValue)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center whitespace-nowrap bg-rose-50/20 font-bold text-rose-700">
                      {r.periodOutQty > 0 ? `-${formatNumber(r.periodOutQty)} ${r.item.unit}` : '-'}
                      {r.periodOutValue > 0 && (
                        <p className="text-[10px] text-rose-600 font-normal">
                          {formatRupiah(r.periodOutValue)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap bg-emerald-50/20 font-mono font-extrabold text-emerald-800">
                      {formatRupiah(r.lifetimeSalesAmount)}
                      <p className="text-[10px] text-slate-500 font-normal">
                        Total {formatNumber(r.lifetimeSalesQty)} {r.item.unit}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      {r.isOut ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700">
                          HABIS (0)
                        </span>
                      ) : r.isLow ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">
                          MENIPIS
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                          AMAN
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredSkuReports.length > 0 && (
              <tfoot className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right uppercase">
                    TOTAL KESELURUHAN:
                  </td>
                  <td className="px-3 py-3 text-center font-extrabold">
                    {formatNumber(totalPhysicalStock)} unit
                  </td>
                  <td></td>
                  <td className="px-3 py-3 text-center text-emerald-800">
                    +{formatNumber(totalPeriodInQty)}
                  </td>
                  <td className="px-3 py-3 text-center text-rose-800">
                    -{formatNumber(totalPeriodOutQty)}
                  </td>
                  <td className="px-4 py-3 text-right font-extrabold font-mono text-emerald-900">
                    {formatRupiah(totalLifetimeSales)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Fast Moving SKU Section */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-2 text-rose-600 mb-2">
          <TrendingUp className="w-5 h-5" />
          <h2 className="text-base font-bold text-slate-900">
            5 SKU Barang Paling Laris / Fast Moving (Periode Terpilih)
          </h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Daftar SKU dengan volume penjualan tertinggi selama periode filter tanggal aktif.
        </p>

        {fastMovingSkus.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            Belum ada data penjualan pada periode tanggal ini.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {fastMovingSkus.map((f, idx) => (
              <div
                key={f.item.id}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-indigo-700">#{idx + 1} {f.item.sku}</span>
                  <span className="text-[10px] font-extrabold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">
                    Terjual
                  </span>
                </div>
                <p className="font-bold text-slate-900 truncate" title={f.item.name}>
                  {f.item.name}
                </p>
                <div className="pt-1 border-t border-slate-200 flex items-baseline justify-between">
                  <span className="font-extrabold text-rose-600">
                    -{formatNumber(f.periodOutQty)} {f.item.unit}
                  </span>
                  <span className="font-mono text-[11px] text-slate-700 font-bold">
                    {formatRupiah(f.periodOutValue)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
