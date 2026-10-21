import React, { useState } from 'react';
import {
  Search,
  Download,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  FileSpreadsheet,
  Trash2,
  RefreshCw,
  FileText,
  Printer,
  X,
  Boxes,
  Check,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Transaction, SpreadsheetConfig, UserAccount } from '../types/inventory.js';
import {
  filterTransactions,
  formatRupiah,
  formatNumber,
  calculateDueDate,
  hasPermission,
} from '../utils/inventory.js';
import { generateNotaPdf } from '../utils/pdfGenerator.js';

interface TransactionHistoryViewProps {
  transactions: Transaction[];
  spreadsheetConfig: SpreadsheetConfig | null;
  activeUser?: UserAccount | null;
  isFetching?: boolean;
  onRefreshFromSheets?: () => void;
  onOpenTransactionModal: (type: 'IN' | 'OUT') => void;
  onDeleteTransaction?: (id: string) => void;
  initialTypeFilter?: 'ALL' | 'IN' | 'OUT';
  onTypeFilterChange?: (type: 'ALL' | 'IN' | 'OUT') => void;
}

export const TransactionHistoryView: React.FC<TransactionHistoryViewProps> = ({
  transactions,
  spreadsheetConfig,
  activeUser,
  isFetching = false,
  onRefreshFromSheets,
  onOpenTransactionModal,
  onDeleteTransaction,
  initialTypeFilter = 'ALL',
  onTypeFilterChange,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'ALL' | 'IN' | 'OUT'>(initialTypeFilter);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedReceiptTx, setSelectedReceiptTx] = useState<Transaction | null>(null);

  // Keep in sync if initialTypeFilter changes externally
  React.useEffect(() => {
    setSelectedType(initialTypeFilter);
  }, [initialTypeFilter]);

  const handleSelectType = (t: 'ALL' | 'IN' | 'OUT') => {
    setSelectedType(t);
    if (onTypeFilterChange) {
      onTypeFilterChange(t);
    }
  };

  const filtered = filterTransactions(transactions, {
    type: selectedType,
    search: searchTerm,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const handleExportExcel = () => {
    const dataToExport = filtered.map((tx, idx) => ({
      No: idx + 1,
      'No. Transaksi': tx.id,
      Tanggal: tx.date,
      Waktu: tx.time,
      Jenis: tx.type === 'IN' ? 'Pembelian / Masuk' : 'Penjualan / Keluar',
      SKU: tx.sku,
      'Nama Barang': tx.itemName,
      Kategori: tx.category,
      Kuantitas: tx.quantity,
      Satuan: tx.unit,
      'Harga Satuan': tx.unitPrice,
      'Total Transaksi': tx.totalPrice,
      'Pelanggan / Supplier': tx.recipientOrSupplier,
      'Lokasi Gudang': tx.targetWarehouse || '-',
      'Sales Penanggung Jawab': tx.salesPerson || '-',
      'Metode Pembayaran': tx.paymentMethod || 'CASH',
      'Jatuh Tempo': calculateDueDate(tx.date, tx.paymentMethod, tx.creditTerm),
      'No. Dokumen': tx.referenceDoc || '-',
      Catatan: tx.notes || '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    const sheetName =
      selectedType === 'IN' ? 'History Pembelian' : selectedType === 'OUT' ? 'History Penjualan' : 'Semua Mutasi';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(
      workbook,
      `${sheetName.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  const totalInTransactions = transactions.filter((t) => t.type === 'IN').length;
  const totalOutTransactions = transactions.filter((t) => t.type === 'OUT').length;

  const totalInQty = filtered
    .filter((t) => t.type === 'IN')
    .reduce((acc, curr) => acc + curr.quantity, 0);

  const totalInValue = filtered
    .filter((t) => t.type === 'IN')
    .reduce((acc, curr) => acc + curr.totalPrice, 0);

  const totalOutQty = filtered
    .filter((t) => t.type === 'OUT')
    .reduce((acc, curr) => acc + curr.quantity, 0);

  const totalOutValue = filtered
    .filter((t) => t.type === 'OUT')
    .reduce((acc, curr) => acc + curr.totalPrice, 0);

  // Sub-metrics for Inbound warehouses
  const inGudangQty = filtered
    .filter((t) => t.type === 'IN' && (t.targetWarehouse === 'Gudang' || t.targetWarehouse === 'Gudang Utama' || !t.targetWarehouse))
    .reduce((acc, curr) => acc + curr.quantity, 0);

  const inPiranhaQty = filtered
    .filter((t) => t.type === 'IN' && (t.targetWarehouse === 'Piranha' || t.targetWarehouse === 'Gudang Piranha'))
    .reduce((acc, curr) => acc + curr.quantity, 0);

  const inTokoQty = filtered
    .filter((t) => t.type === 'IN' && t.targetWarehouse === 'Toko')
    .reduce((acc, curr) => acc + curr.quantity, 0);

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            {selectedType === 'IN'
              ? 'History Pembelian'
              : selectedType === 'OUT'
              ? 'History Penjualan'
              : 'Semua Riwayat Mutasi Barang'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            {selectedType === 'IN'
              ? 'Log riwayat pembelian dan penerimaan stok barang dari supplier ke gudang.'
              : selectedType === 'OUT'
              ? 'Log riwayat penjualan barang kepada pelanggan dengan rincian nota dan tim sales.'
              : 'Log lengkap seluruh riwayat mutasi pembelian dan penjualan barang terintegrasi.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeUser?.username === 'server' && (
            <>
              <div className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Sheet &quot;HISTORY PEMBELIAN&quot; &amp; &quot;PENJUALAN&quot;</span>
              </div>

              {onRefreshFromSheets && (
                <button
                  onClick={onRefreshFromSheets}
                  disabled={isFetching}
                  className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:bg-slate-400"
                  title="Tarik data riwayat pembelian & penjualan terbaru dari Google Sheets"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                  <span>{isFetching ? 'Mengambil...' : 'Tarik dari Sheet'}</span>
                </button>
              )}
            </>
          )}

          <button
            onClick={handleExportExcel}
            className="flex items-center space-x-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export to Excel</span>
          </button>

          <button
            onClick={() => onOpenTransactionModal('IN')}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Barang Masuk</span>
          </button>

          <button
            onClick={() => onOpenTransactionModal('OUT')}
            className="flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>- Penjualan</span>
          </button>
        </div>
      </div>

      {/* Main Mode Navigation Tabs (Pilihan Menu Terpisah) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-1.5 bg-slate-200/70 rounded-2xl">
        <button
          type="button"
          onClick={() => handleSelectType('ALL')}
          className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            selectedType === 'ALL'
              ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-300'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-slate-500" />
          <span>Semua Mutasi</span>
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 font-extrabold">
            {transactions.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectType('IN')}
          className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            selectedType === 'IN'
              ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400'
              : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/50'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
          <span>History Pembelian</span>
          <span className={`ml-1.5 px-2 py-0.5 rounded-full text-xs font-extrabold ${
            selectedType === 'IN' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
          }`}>
            {totalInTransactions}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectType('OUT')}
          className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            selectedType === 'OUT'
              ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-400'
              : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50/50'
          }`}
        >
          <ArrowUpRight className="w-4 h-4 text-rose-400" />
          <span>History Penjualan</span>
          <span className={`ml-1.5 px-2 py-0.5 rounded-full text-xs font-extrabold ${
            selectedType === 'OUT' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800'
          }`}>
            {totalOutTransactions}
          </span>
        </button>
      </div>

      {/* Mode-specific Metric Summary Banner */}
      {selectedType === 'IN' && (
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 bg-emerald-50/70 border border-emerald-200 p-4 rounded-2xl">
          <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase block">Total Transaksi</span>
            <span className="text-xl font-extrabold text-emerald-900">{filtered.length} trx</span>
          </div>
          <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase block">Total Unit Diterima</span>
            <span className="text-xl font-extrabold text-emerald-700">+{formatNumber(totalInQty)} unit</span>
          </div>
          <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase block">Masuk Gudang</span>
            <span className="text-xl font-extrabold text-indigo-700">{formatNumber(inGudangQty)} unit</span>
          </div>
          <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase block">Masuk Piranha</span>
            <span className="text-xl font-extrabold text-cyan-700">{formatNumber(inPiranhaQty)} unit</span>
          </div>
          <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase block">Masuk Toko</span>
            <span className="text-xl font-extrabold text-amber-700">{formatNumber(inTokoQty)} unit</span>
          </div>
        </div>
      )}

      {selectedType === 'OUT' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-rose-50/70 border border-rose-200 p-4 rounded-2xl">
          <div className="p-3 bg-white rounded-xl border border-rose-100 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase block">Total Transaksi Penjualan</span>
            <span className="text-xl font-extrabold text-rose-950">{filtered.length} transaksi</span>
          </div>
          <div className="p-3 bg-white rounded-xl border border-rose-100 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase block">Total Kuantitas Terjual</span>
            <span className="text-xl font-extrabold text-rose-700">-{formatNumber(totalOutQty)} unit</span>
          </div>
          <div className="p-3 bg-white rounded-xl border border-rose-100 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase block">Total Omzet Penjualan</span>
            <span className="text-xl font-extrabold text-emerald-800">{formatRupiah(totalOutValue)}</span>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder={
                selectedType === 'IN'
                  ? 'Cari SKU, nama barang, supplier, gudang tujuan, no PO/SJ...'
                  : selectedType === 'OUT'
                  ? 'Cari SKU, pelanggan, sales penanggung jawab, kategori harga, no DO...'
                  : 'Cari SKU, nama barang, supplier, pelanggan, sales, no ref...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Quick Date Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-600 font-bold">Filter Tanggal:</span>
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
                  const today = new Date().toISOString().slice(0, 10);
                  setStartDate(today);
                  setEndDate(today);
                }}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  const end = new Date();
                  const start = new Date();
                  start.setDate(start.getDate() - 7);
                  setStartDate(start.toISOString().slice(0, 10));
                  setEndDate(end.toISOString().slice(0, 10));
                }}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold"
              >
                7 Hari
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const y = now.getFullYear();
                  const m = String(now.getMonth() + 1).padStart(2, '0');
                  setStartDate(`${y}-${m}-01`);
                  setEndDate(now.toISOString().slice(0, 10));
                }}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold"
              >
                Bulan Ini
              </button>
            </div>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded-lg font-bold transition-colors"
              >
                ✕ Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              {selectedType === 'IN' ? (
                <tr>
                  <th className="px-4 py-3.5">ID Masuk</th>
                  <th className="px-4 py-3.5">Waktu Penerimaan</th>
                  <th className="px-4 py-3.5">Nama Barang & SKU</th>
                  <th className="px-4 py-3.5 text-center bg-emerald-100/40 text-emerald-900 border-x border-emerald-200">
                    🏢 Lokasi Gudang Masuk
                  </th>
                  <th className="px-4 py-3.5 text-right">Kuantitas Masuk</th>
                  <th className="px-4 py-3.5 text-right">Harga Modal Satuan</th>
                  <th className="px-4 py-3.5 text-right">Total Nilai Pembelian</th>
                  <th className="px-4 py-3.5">Pemasok / Supplier</th>
                  <th className="px-4 py-3.5">No. PO / Surat Jalan</th>
                  <th className="px-4 py-3.5">Petugas Penerima</th>
                  <th className="px-4 py-3.5 text-center">Aksi</th>
                </tr>
              ) : selectedType === 'OUT' ? (
                <tr>
                  <th className="px-4 py-3.5">ID Penjualan</th>
                  <th className="px-4 py-3.5">Waktu Penjualan</th>
                  <th className="px-4 py-3.5">Nama Barang & SKU</th>
                  <th className="px-4 py-3.5 text-center bg-rose-100/40 text-rose-900 border-x border-rose-200">
                    🏷️ Kategori Harga
                  </th>
                  <th className="px-4 py-3.5 text-right">Kuantitas Terjual</th>
                  <th className="px-4 py-3.5 text-right">Harga Satuan Terjual</th>
                  <th className="px-4 py-3.5 text-right">Total Penjualan</th>
                  <th className="px-4 py-3.5">Pelanggan / Customer</th>
                  <th className="px-4 py-3.5">Sales Penanggung Jawab</th>
                  <th className="px-4 py-3.5">Metode Pembayaran</th>
                  <th className="px-4 py-3.5">No. DO / Ref</th>
                  <th className="px-4 py-3.5 text-center">Aksi</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-4 py-3.5">ID / No.</th>
                  <th className="px-4 py-3.5">Waktu Transaksi</th>
                  <th className="px-4 py-3.5">Jenis</th>
                  <th className="px-4 py-3.5">Nama Barang & SKU</th>
                  <th className="px-4 py-3.5 text-right">Kuantitas</th>
                  <th className="px-4 py-3.5 text-right">Total Nilai</th>
                  <th className="px-4 py-3.5">Pemasok / Pelanggan</th>
                  <th className="px-4 py-3.5">Sales / PIC</th>
                  <th className="px-4 py-3.5">No. Referensi</th>
                  <th className="px-4 py-3.5">Catatan</th>
                  <th className="px-4 py-3.5 text-center">Aksi</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-12 text-slate-600">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">
                      Belum ada riwayat mutasi {selectedType === 'IN' ? 'barang masuk' : selectedType === 'OUT' ? 'penjualan' : ''} yang sesuai
                    </p>
                    <p className="text-xs">Ubah kata kunci filter atau catat transaksi baru.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((tx, idx) => (
                  <tr key={`${tx.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-600 whitespace-nowrap">
                      {tx.id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-semibold text-slate-900">{tx.date}</p>
                      <p className="text-[11px] text-slate-600 font-mono">{tx.time}</p>
                    </td>

                    {selectedType === 'ALL' && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        {tx.type === 'IN' ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <ArrowDownLeft className="w-3 h-3" />
                            <span>MASUK</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <ArrowUpRight className="w-3 h-3" />
                            <span>PENJUALAN</span>
                          </span>
                        )}
                      </td>
                    )}

                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">{tx.itemName}</p>
                      <p className="text-[11px] text-slate-600 font-mono">[{tx.sku}] - {tx.category}</p>
                    </td>

                    {/* Khusus Inbound: Gudang Tujuan */}
                    {selectedType === 'IN' && (
                      <td className="px-4 py-3 text-center whitespace-nowrap bg-emerald-50/20 border-x border-emerald-100/50">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${
                          tx.targetWarehouse === 'Gudang Piranha'
                            ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}>
                          🏢 {tx.targetWarehouse || 'Gudang Utama'}
                        </span>
                      </td>
                    )}

                    {/* Khusus Outbound: Kategori Harga */}
                    {selectedType === 'OUT' && (
                      <td className="px-4 py-3 text-center whitespace-nowrap bg-rose-50/20 border-x border-rose-100/50">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                          tx.priceTierUsed === 'custom'
                            ? 'bg-teal-50 text-teal-800 border-teal-300'
                            : tx.priceTierUsed === 'grosir'
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            : tx.priceTierUsed === 'partai'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : tx.priceTierUsed === 'modal'
                            ? 'bg-slate-100 text-slate-800 border-slate-300'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}>
                          {tx.priceTierUsed === 'custom' ? '✏️ Custom' : tx.priceTierUsed || 'Eceran'}
                        </span>
                      </td>
                    )}

                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className={`text-sm font-extrabold ${tx.type === 'IN' ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {tx.type === 'IN' ? '+' : '-'}{formatNumber(tx.quantity)} {tx.unit}
                      </span>
                    </td>

                    {(selectedType === 'IN' || selectedType === 'OUT') && (
                      <td className="px-4 py-3 text-right text-slate-700 font-mono whitespace-nowrap">
                        {formatRupiah(tx.unitPrice)}
                      </td>
                    )}

                    <td className="px-4 py-3 text-right font-extrabold text-slate-900 whitespace-nowrap">
                      {formatRupiah(tx.totalPrice)}
                    </td>

                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{tx.recipientOrSupplier}</p>
                      {selectedType === 'ALL' && tx.targetWarehouse && tx.type === 'IN' && (
                        <span className="text-[10px] text-emerald-700 font-bold block">
                          🏢 {tx.targetWarehouse}
                        </span>
                      )}
                    </td>

                    {/* Sales Column */}
                    {(selectedType === 'OUT' || selectedType === 'ALL') && (
                      <td className="px-4 py-3">
                        {tx.salesPerson ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            <span>👤 {tx.salesPerson}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>
                    )}

                    {/* Payment Column for Outbound */}
                    {selectedType === 'OUT' && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                          tx.paymentMethod === 'KREDIT'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}>
                          {tx.paymentMethod || 'CASH'} {tx.creditTerm ? `• ${tx.creditTerm}` : ''}
                        </span>
                      </td>
                    )}

                    <td className="px-4 py-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                      {tx.referenceDoc || '-'}
                    </td>

                    {selectedType === 'IN' && (
                      <td className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap">
                        {tx.operator}
                      </td>
                    )}

                    {selectedType === 'ALL' && (
                      <td className="px-4 py-3 text-slate-600 text-[11px] max-w-xs truncate">
                        {tx.notes || '-'}
                      </td>
                    )}

                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center space-x-1.5">
                        {tx.type === 'OUT' && (
                          <button
                            type="button"
                            onClick={() => setSelectedReceiptTx(tx)}
                            title={`Cetak Nota Penjualan [${tx.id}]`}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 rounded-lg text-xs font-bold transition-colors border border-emerald-200 shadow-2xs"
                          >
                            <Printer className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Nota</span>
                          </button>
                        )}
                        {hasPermission(activeUser, tx.type === 'IN' ? 'history_in' : 'history_out', 'delete') && (
                          <button
                            type="button"
                            onClick={() => onDeleteTransaction && onDeleteTransaction(tx.id)}
                            title={`Hapus catatan mutasi [${tx.id}]`}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 hover:text-rose-800 rounded-lg text-xs font-bold transition-colors border border-rose-200 shadow-2xs"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Hapus</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nota Penjualan Modal Preview & Print */}
      {selectedReceiptTx && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex items-center justify-between border-b border-emerald-700">
              <div className="flex items-center space-x-3">
                <span className="p-2 bg-white/20 rounded-xl">
                  <Printer className="w-5 h-5 text-white" />
                </span>
                <div>
                  <h3 className="text-lg font-extrabold tracking-tight">Nota Penjualan</h3>
                  <p className="text-xs text-emerald-200">No. Transaksi: {selectedReceiptTx.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceiptTx(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Nota Body */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 bg-slate-50">
              <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
                {/* Brand & Invoice Header */}
                <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">GLOBAL MART</h2>
                    <p className="text-xs font-semibold text-slate-600">Pusatnya belanja Alat Tulis Kantor &amp; Sekolah</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Jl. Gurita I no 38, Blok 9 Pegok-Sesetan, Denpasar-Bali</p>
                  </div>
                  <div className="text-right">
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-black uppercase tracking-wider">
                      NOTA PENJUALAN
                    </span>
                    <p className="text-xs font-mono font-bold text-slate-800 mt-2">{selectedReceiptTx.id}</p>
                    <p className="text-xs text-slate-500">{selectedReceiptTx.date} • {selectedReceiptTx.time}</p>
                  </div>
                </div>

                {/* Customer & Sales Details */}
                <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                  <div>
                    <span className="text-slate-500 font-bold block mb-1">KEPADA PELANGGAN:</span>
                    <p className="font-extrabold text-slate-900 text-sm">{selectedReceiptTx.recipientOrSupplier}</p>
                    <p className="text-slate-600 mt-0.5">Metode: <strong className="text-slate-900">{selectedReceiptTx.paymentMethod || 'CASH'}</strong> {selectedReceiptTx.creditTerm ? `(${selectedReceiptTx.creditTerm})` : ''}</p>
                    <p className="text-slate-600 mt-0.5">Jatuh Tempo: <strong className="text-slate-900 font-mono">{calculateDueDate(selectedReceiptTx.date, selectedReceiptTx.paymentMethod, selectedReceiptTx.creditTerm)}</strong></p>
                    {selectedReceiptTx.referenceDoc && (
                      <p className="text-slate-600 mt-0.5">No. DO/Ref: <strong className="font-mono">{selectedReceiptTx.referenceDoc}</strong></p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 font-bold block mb-1">TIM SALES PENANGGUNG JAWAB:</span>
                    <p className="font-extrabold text-rose-700 text-sm">{selectedReceiptTx.salesPerson || 'Belum ditugaskan'}</p>
                  </div>
                </div>

                {/* Items Table */}
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">Nama Barang & SKU</th>
                      <th className="px-3 py-2.5 text-center">Kuantitas</th>
                      <th className="px-3 py-2.5 text-right">Harga Satuan</th>
                      <th className="px-3 py-2.5 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    <tr>
                      <td className="px-3 py-3">
                        <p className="font-extrabold text-slate-900">{selectedReceiptTx.itemName}</p>
                        <p className="text-[11px] text-slate-500 font-mono">SKU: {selectedReceiptTx.sku} • {selectedReceiptTx.category}</p>
                      </td>
                      <td className="px-3 py-3 text-center font-bold">
                        {formatNumber(selectedReceiptTx.quantity)} {selectedReceiptTx.unit}
                      </td>
                      <td className="px-3 py-3 text-right font-mono">
                        {formatRupiah(selectedReceiptTx.unitPrice)}
                      </td>
                      <td className="px-3 py-3 text-right font-extrabold text-slate-900 font-mono">
                        {formatRupiah(selectedReceiptTx.totalPrice)}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 font-extrabold text-sm text-slate-900">
                      <td colSpan={3} className="px-3 py-4 text-right">TOTAL PEMBAYARAN:</td>
                      <td className="px-3 py-4 text-right text-emerald-800 text-base font-black font-mono">
                        {formatRupiah(selectedReceiptTx.totalPrice)}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Notes & Auto-print notice (No signature column) */}
                <div className="pt-4 border-t border-slate-200 space-y-3 text-xs">
                  <div>
                    <span className="font-bold text-slate-700 block mb-1">Catatan Transaksi:</span>
                    <p className="text-slate-600 italic">{selectedReceiptTx.notes || 'Terima kasih atas kepercayaan Anda.'}</p>
                  </div>
                  <div className="pt-3 border-t border-slate-100 text-center text-slate-500 text-[11px] font-medium italic">
                    Nota ini diprint secara otomatis, tidak memerlukan tanda tangan
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedReceiptTx(null)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Tutup
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    generateNotaPdf({
                      transactionId: selectedReceiptTx.id,
                      date: selectedReceiptTx.date,
                      time: selectedReceiptTx.time,
                      recipient: selectedReceiptTx.recipientOrSupplier,
                      paymentMethod: selectedReceiptTx.paymentMethod,
                      creditTerm: selectedReceiptTx.creditTerm,
                      dueDate: calculateDueDate(selectedReceiptTx.date, selectedReceiptTx.paymentMethod, selectedReceiptTx.creditTerm),
                      referenceDoc: selectedReceiptTx.referenceDoc,
                      salesPerson: selectedReceiptTx.salesPerson,
                      itemName: selectedReceiptTx.itemName,
                      sku: selectedReceiptTx.sku,
                      category: selectedReceiptTx.category,
                      quantity: selectedReceiptTx.quantity,
                      unit: selectedReceiptTx.unit,
                      unitPrice: selectedReceiptTx.unitPrice,
                      totalPrice: selectedReceiptTx.totalPrice,
                      notes: selectedReceiptTx.notes,
                    });
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5"
                >
                  <FileText className="w-4 h-4 text-slate-600" />
                  <span>Simpan ke PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center space-x-2 shadow-md shadow-emerald-600/20"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Nota</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
