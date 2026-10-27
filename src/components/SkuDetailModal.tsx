import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  Package,
  Layers,
  Tag,
  Warehouse,
  Store,
  Coins,
  TrendingUp,
  Clock,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  Edit2,
  Copy,
  Check,
  ShieldCheck,
  Building2,
  Boxes,
} from 'lucide-react';
import type { Item, TransactionType, UserAccount } from '../types/inventory.js';
import {
  formatRupiah,
  formatNumber,
  calculateMarginFromPrices,
  hasPermission,
} from '../utils/inventory.js';

interface SkuDetailModalProps {
  item: Item | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (item: Item) => void;
  onOpenTransaction?: (type: TransactionType, itemId: string) => void;
  activeUser?: UserAccount | null;
}

export const SkuDetailModal: React.FC<SkuDetailModalProps> = ({
  item,
  isOpen,
  onClose,
  onEdit,
  onOpenTransaction,
  activeUser,
}) => {
  const [copiedSku, setCopiedSku] = useState(false);

  if (!isOpen || !item) return null;

  const cost = item.costPrice ?? item.unitPrice ?? 0;
  const eceran = item.priceEceran ?? item.priceTiers?.eceran ?? 0;
  const grosir = item.priceGrosir ?? item.priceTiers?.grosir ?? 0;
  const partai = item.pricePartai ?? item.priceTiers?.partai ?? 0;
  const marginPercent =
    item.profitMarginPercent ??
    (cost > 0 && eceran > cost ? calculateMarginFromPrices(cost, eceran) : 0);

  const stockGudang =
    item.stockGudang ??
    item.stockGudangUtama ??
    (item.location?.includes('Piranha') || item.location?.includes('Toko') ? 0 : item.currentStock);
  const stockToko =
    item.stockToko ?? (item.location?.includes('Toko') ? item.currentStock : 0);
  const stockPiranha =
    item.stockPiranha ??
    item.stockGudangPiranha ??
    (item.location?.includes('Piranha') ? item.currentStock : 0);

  const totalStock = item.currentStock;
  const totalStockValue = totalStock * cost;
  const merk = item.merk || item.brand || '-';

  const isOutOfStock = totalStock <= 0;
  const isLowStock = totalStock > 0 && totalStock <= item.minStock;
  const stockStatus = isOutOfStock
    ? 'HABIS'
    : isLowStock
    ? 'MENIPIS'
    : 'AMAN';

  const handleCopySku = () => {
    navigator.clipboard.writeText(item.sku);
    setCopiedSku(true);
    setTimeout(() => setCopiedSku(false), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sku-detail-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
    >
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 sm:p-6 text-white relative">
          <button
            onClick={onClose}
            aria-label="Tutup detail SKU"
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center space-x-1.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Data Sheet: "STOCK LIST"</span>
            </span>
            <span
              className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isOutOfStock
                  ? 'bg-rose-500/30 text-rose-200 border border-rose-400/40'
                  : isLowStock
                  ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40'
                  : 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40'
              }`}
            >
              {isOutOfStock ? (
                <AlertTriangle className="w-3 h-3 text-rose-300" />
              ) : isLowStock ? (
                <AlertTriangle className="w-3 h-3 text-amber-300" />
              ) : (
                <ShieldCheck className="w-3 h-3 text-emerald-300" />
              )}
              <span>Status: {stockStatus}</span>
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mt-2">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-xs uppercase font-semibold text-slate-400">
                  SKU:
                </span>
                <span className="font-mono text-xl sm:text-2xl font-black text-white tracking-wider bg-white/10 px-3 py-0.5 rounded-xl border border-white/20">
                  {item.sku}
                </span>
                <button
                  onClick={handleCopySku}
                  title="Salin SKU"
                  className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  {copiedSku ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              <h2 id="sku-detail-title" className="text-lg sm:text-xl font-bold text-slate-100">
                {item.name}
              </h2>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <span className="text-[11px] text-slate-400 block">Total Stok Fisik</span>
              <span className="text-2xl font-extrabold text-emerald-400">
                {formatNumber(totalStock)} <span className="text-sm font-semibold text-slate-300">{item.unit}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs">
          {/* Section 1: Identitas & Klasifikasi Barang Sesuai Sheet */}
          <div>
            <div className="flex items-center space-x-2 text-slate-900 font-extrabold text-sm mb-3">
              <Package className="w-4 h-4 text-indigo-600" />
              <span>1. Informasi Identitas & Klasifikasi Barang</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* SKU */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="text-[10px] text-slate-500 font-medium block">
                  SKU
                </span>
                <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">
                  {item.sku}
                </span>
              </div>

              {/* ID Sistem */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="text-[10px] text-slate-500 font-medium block">
                  ID Sistem / Barcode
                </span>
                <span className="font-mono text-slate-700 text-xs mt-0.5 block truncate">
                  {item.id}
                </span>
              </div>

              {/* Nama Produk */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl sm:col-span-1 col-span-2">
                <span className="text-[10px] text-slate-500 font-medium block">
                  Nama Produk
                </span>
                <span className="font-bold text-slate-900 text-xs mt-0.5 block">
                  {item.name}
                </span>
              </div>

              {/* Unit */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="text-[10px] text-slate-500 font-medium block">
                  Unit / Satuan
                </span>
                <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                  {item.unit || 'pcs'}
                </span>
              </div>

              {/* Isi Per Dus */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="text-[10px] text-slate-500 font-medium block">
                  Isi Per Dus (Karton)
                </span>
                <span className="font-bold text-amber-700 text-sm mt-0.5 block">
                  📦 {item.isiPerDus || 1} {item.unit}/dus
                </span>
              </div>

              {/* Stok Minimum */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="text-[10px] text-slate-500 font-medium block">
                  Batas Stok Minimal
                </span>
                <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                  {formatNumber(item.minStock)} {item.unit}
                </span>
              </div>

              {/* Kategori */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="text-[10px] text-slate-500 font-medium block">
                  Kategori Produk
                </span>
                <span className="inline-block bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded text-xs mt-1 border border-indigo-200">
                  {item.category || 'Umum'}
                </span>
              </div>

              {/* Lokasi Rak */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="text-[10px] text-slate-500 font-medium block">
                  Lokasi Rak / Gudang
                </span>
                <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                  🏢 {item.location || 'Gudang'}
                </span>
              </div>

              {/* Merk */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="text-[10px] text-slate-500 font-medium block">
                  Merk / Brand
                </span>
                <span className="font-bold text-slate-900 text-xs mt-0.5 block">
                  🏷️ {merk}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Struktur Harga Jual Berjenjang & Modal Sesuai Sheet */}
          <div>
            <div className="flex items-center space-x-2 text-slate-900 font-extrabold text-sm mb-3">
              <Coins className="w-4 h-4 text-emerald-600" />
              <span>2. Struktur Harga Pokok (HPP) & Harga Jual 3-Tier</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* HPP (Modal) */}
              <div className="p-3.5 bg-slate-100 border border-slate-300 rounded-2xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-600">
                    HPP (Modal)
                  </span>
                  <span className="text-[10px] bg-white px-1.5 py-0.5 rounded text-slate-600 font-mono">
                    Dasar
                  </span>
                </div>
                <div className="text-base font-extrabold text-slate-900">
                  {formatRupiah(cost)}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Margin: {marginPercent}%
                </span>
              </div>

              {/* Eceran */}
              <div className="p-3.5 bg-emerald-50/70 border-2 border-emerald-300 rounded-2xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-extrabold text-emerald-900">
                    Eceran
                  </span>
                  <span className="text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded">
                    Retail
                  </span>
                </div>
                <div className="text-base font-black text-emerald-700">
                  {formatRupiah(eceran)}
                </div>
                <span className="text-[10px] text-emerald-700 font-semibold mt-1 block">
                  Untung: +{formatRupiah(Math.max(0, eceran - cost))}
                </span>
              </div>

              {/* Grosir */}
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-extrabold text-indigo-900">
                    Grosir
                  </span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.2 rounded">
                    Reseller
                  </span>
                </div>
                <div className="text-base font-bold text-indigo-700">
                  {formatRupiah(grosir)}
                </div>
                <span className="text-[10px] text-indigo-700 font-semibold mt-1 block">
                  Untung: +{formatRupiah(Math.max(0, grosir - cost))}
                </span>
              </div>

              {/* Partai */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-extrabold text-amber-900">
                    Partai
                  </span>
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded">
                    Koli/Dus
                  </span>
                </div>
                <div className="text-base font-bold text-amber-700">
                  {formatRupiah(partai)}
                </div>
                <span className="text-[10px] text-amber-700 font-semibold mt-1 block">
                  Untung: +{formatRupiah(Math.max(0, partai - cost))}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Informasi Stok Multi-Gudang & Nilai Modal */}
          <div>
            <div className="flex items-center space-x-2 text-slate-900 font-extrabold text-sm mb-3">
              <Boxes className="w-4 h-4 text-blue-600" />
              <span>3. Posisi Stok Per Gudang & Total Nilai Modal</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Stok Gudang */}
              <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-2xl">
                <div className="flex items-center space-x-1.5 text-blue-900 font-bold mb-1">
                  <Warehouse className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-[10px]">Gudang</span>
                </div>
                <div className="text-lg font-extrabold text-blue-900">
                  {formatNumber(stockGudang)} <span className="text-xs font-medium">{item.unit}</span>
                </div>
                <span className="text-[10px] text-blue-700 block mt-0.5">
                  Nilai: {formatRupiah(stockGudang * cost)}
                </span>
              </div>

              {/* Stok Toko */}
              <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-2xl">
                <div className="flex items-center space-x-1.5 text-amber-900 font-bold mb-1">
                  <Store className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-[10px]">Toko</span>
                </div>
                <div className="text-lg font-extrabold text-amber-900">
                  {formatNumber(stockToko)} <span className="text-xs font-medium">{item.unit}</span>
                </div>
                <span className="text-[10px] text-amber-700 block mt-0.5">
                  Nilai: {formatRupiah(stockToko * cost)}
                </span>
              </div>

              {/* Stok Piranha */}
              <div className="p-3.5 bg-teal-50/60 border border-teal-200 rounded-2xl">
                <div className="flex items-center space-x-1.5 text-teal-900 font-bold mb-1">
                  <Building2 className="w-3.5 h-3.5 text-teal-600" />
                  <span className="text-[10px]">Piranha</span>
                </div>
                <div className="text-lg font-extrabold text-teal-900">
                  {formatNumber(stockPiranha)} <span className="text-xs font-medium">{item.unit}</span>
                </div>
                <span className="text-[10px] text-teal-700 block mt-0.5">
                  Nilai: {formatRupiah(stockPiranha * cost)}
                </span>
              </div>

              {/* Total Nilai Modal */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-300 rounded-2xl">
                <div className="flex items-center space-x-1.5 text-emerald-900 font-bold mb-1">
                  <Coins className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[10px]">Total Nilai Modal</span>
                </div>
                <div className="text-base sm:text-lg font-extrabold text-emerald-900">
                  {formatRupiah(totalStockValue)}
                </div>
                <span className="text-[10px] text-emerald-700 block mt-0.5">
                  Total: {formatNumber(totalStock)} {item.unit}
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Catatan & Waktu Update Sesuai Sheet */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            {/* Catatan */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="flex items-center space-x-1.5 text-slate-700 font-bold mb-1">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[10px]">Catatan / Keterangan</span>
              </div>
              <p className="text-slate-800 text-xs italic">
                {item.notes || 'Tidak ada catatan tambahan.'}
              </p>
            </div>

            {/* Terakhir Update */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="flex items-center space-x-1.5 text-slate-700 font-bold mb-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[10px]">Terakhir Diperbarui</span>
              </div>
              <p className="text-slate-800 text-xs font-mono font-semibold">
                {item.lastUpdated || '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer / Quick Actions */}
        <div className="bg-slate-50 px-5 py-4 border-t border-slate-200 flex flex-wrap items-center justify-end gap-3">

          <div className="flex items-center space-x-2">
            {onEdit && hasPermission(activeUser, 'master', 'edit') && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(item);
                }}
                className="flex items-center space-x-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs shadow-xs cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Edit Barang</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
