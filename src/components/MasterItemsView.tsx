import React, { useState } from 'react';
import {
  Search,
  Plus,
  Filter,
  Edit2,
  Trash2,
  AlertTriangle,
  Package,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  X,
  Check,
  TrendingUp,
  Percent,
  Coins,
  Calculator,
  RefreshCw,
  ExternalLink,
  Download,
  Eye,
} from 'lucide-react';
import type { Item, TransactionType, UserAccount } from '../types/inventory.js';
import {
  formatRupiah,
  formatNumber,
  calculateTierPrices,
  calculateMarginFromPrices,
  hasPermission,
} from '../utils/inventory.js';
import { SkuDetailModal } from './SkuDetailModal.js';

interface MasterItemsViewProps {
  items: Item[];
  activeUser?: UserAccount | null;
  onAddItem: (item: Omit<Item, 'id' | 'lastUpdated'>) => void;
  onUpdateItem: (item: Item) => void;
  onDeleteItem: (itemId: string) => void;
  onOpenTransactionModal: (type: TransactionType, preselectedItemId: string) => void;
  onSyncToSheets?: () => void;
  onFetchFromSheets?: () => void;
  isSyncing?: boolean;
  isFetchingFromSheets?: boolean;
  spreadsheetUrl?: string;
}

export const MasterItemsView: React.FC<MasterItemsViewProps> = ({
  items,
  activeUser,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onOpenTransactionModal,
  onSyncToSheets,
  onFetchFromSheets,
  isSyncing = false,
  isFetchingFromSheets = false,
  spreadsheetUrl,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'SAFE' | 'LOW' | 'OUT'>('ALL');

  // Edit / Add Item State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  // Detail Modal State (Sheet "STOCK LIST")
  const [viewingDetailItem, setViewingDetailItem] = useState<Item | null>(null);

  // Form Basic Fields
  const [formSku, setFormSku] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formUnit, setFormUnit] = useState('pcs');
  const [formMerk, setFormMerk] = useState('');
  const [formMinStock, setFormMinStock] = useState<number>(5);
  const [formCurrentStock, setFormCurrentStock] = useState<number>(0);
  const [formStockGudang, setFormStockGudang] = useState<number>(0);
  const [formStockPiranha, setFormStockPiranha] = useState<number>(0);
  const [formStockToko, setFormStockToko] = useState<number>(0);
  const [formIsiPerDus, setFormIsiPerDus] = useState<number>(1);
  const [formLocation, setFormLocation] = useState('Gudang');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Form Price & Profit Fields (bebas diinput angka apa saja tanpa batasan)
  const [formCostPrice, setFormCostPrice] = useState<string>('50000'); // Harga Modal
  const [formMarginPercent, setFormMarginPercent] = useState<string>('25'); // % Keuntungan (bebas diinput angka apa saja)
  const [formPriceEceran, setFormPriceEceran] = useState<string>('62500'); // Eceran
  const [formPriceGrosir, setFormPriceGrosir] = useState<string>('58750'); // Grosir
  const [formPricePartai, setFormPricePartai] = useState<string>('55000'); // Partai

  // Extract unique categories
  const categories = Array.from(new Set(items.map((i) => i.category))).filter(Boolean);

  // Helper to recompute Eceran strictly from cost and margin
  const updateEceranFromCostAndMargin = (cost: number, marginStr: string) => {
    const marginNum = parseFloat(marginStr);
    if (!isNaN(marginNum)) {
      const eceran = Math.round(cost * (1 + marginNum / 100));
      setFormPriceEceran(String(Math.max(0, eceran)));
    }
  };

  // Harga modal bisa diisi angka bebas (desimal/bulat/angka berapapun)
  const handleCostPriceChange = (raw: string) => {
    setFormCostPrice(raw);
    const num = parseFloat(raw);
    if (!isNaN(num) && num >= 0) {
      // % Keuntungan strictly calculates Eceran price
      updateEceranFromCostAndMargin(num, formMarginPercent);
    }
  };

  // User can input any free number (decimals, large numbers, 0, etc.)
  const handleMarginChange = (raw: string | number) => {
    const str = String(raw);
    setFormMarginPercent(str);
    const num = parseFloat(str);
    const costNum = parseFloat(formCostPrice);
    if (!isNaN(num) && !isNaN(costNum) && costNum > 0) {
      const eceran = Math.round(costNum * (1 + num / 100));
      setFormPriceEceran(String(Math.max(0, eceran)));
    }
  };

  const handleEceranChange = (raw: string) => {
    setFormPriceEceran(raw);
    const eceranNum = parseFloat(raw);
    const costNum = parseFloat(formCostPrice);
    // % Keuntungan strictly displays the profit % from Harga Eceran only
    if (!isNaN(eceranNum) && !isNaN(costNum) && costNum > 0) {
      const impliedMargin = calculateMarginFromPrices(costNum, eceranNum);
      setFormMarginPercent(String(impliedMargin));
    }
  };

  const handleGrosirChange = (raw: string) => {
    setFormPriceGrosir(raw);
  };

  const handlePartaiChange = (raw: string) => {
    setFormPricePartai(raw);
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormSku(`SKU-${Math.floor(100 + Math.random() * 900)}`);
    setFormName('');
    setFormCategory(categories[0] || 'Umum');
    setFormUnit('pcs');
    setFormMerk('');
    setFormMinStock(5);
    setFormCurrentStock(0);
    setFormStockGudang(0);
    setFormStockPiranha(0);
    setFormStockToko(0);
    setFormIsiPerDus(1);
    setFormCostPrice('50000');
    setFormMarginPercent('25');
    const initialTiers = calculateTierPrices(50000, 25);
    setFormPriceEceran(String(initialTiers.eceran));
    setFormPriceGrosir(String(initialTiers.grosir));
    setFormPricePartai(String(initialTiers.partai));
    setFormLocation('Gudang');
    setFormNotes('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: Item) => {
    setEditingItem(item);
    setFormSku(item.sku);
    setFormName(item.name);
    setFormCategory(item.category);
    setFormUnit(item.unit);
    setFormMerk(item.merk || item.brand || '');
    setFormMinStock(item.minStock);
    setFormCurrentStock(item.currentStock);
    
    const stockGudang = item.stockGudang ?? item.stockGudangUtama ?? (item.location?.includes('Piranha') || item.location?.includes('Toko') ? 0 : item.currentStock);
    const stockPiranha = item.stockPiranha ?? item.stockGudangPiranha ?? (item.location?.includes('Piranha') ? item.currentStock : 0);
    const stockToko = item.stockToko ?? (item.location?.includes('Toko') ? item.currentStock : 0);
    setFormStockGudang(stockGudang);
    setFormStockPiranha(stockPiranha);
    setFormStockToko(stockToko);
    setFormIsiPerDus(item.isiPerDus || 1);

    const cost = item.costPrice ?? item.unitPrice ?? 0;
    const margin = item.profitMarginPercent ?? (item.priceEceran ? calculateMarginFromPrices(cost, item.priceEceran) : 25);
    setFormCostPrice(String(cost));
    setFormMarginPercent(String(margin));

    const existingTiers = calculateTierPrices(cost, margin);
    setFormPriceEceran(String(item.priceEceran ?? item.priceTiers?.eceran ?? existingTiers.eceran));
    setFormPriceGrosir(String(item.priceGrosir ?? item.priceTiers?.grosir ?? existingTiers.grosir));
    setFormPricePartai(String(item.pricePartai ?? item.priceTiers?.partai ?? existingTiers.partai));

    setFormLocation(item.location || 'Gudang');
    setFormNotes(item.notes || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formSku.trim()) {
      setFormError('Kode SKU tidak boleh kosong.');
      return;
    }
    if (!formName.trim()) {
      setFormError('Nama barang tidak boleh kosong.');
      return;
    }

    const costNum = parseFloat(formCostPrice);
    if (isNaN(costNum) || costNum < 0) {
      setFormError('Harga modal harus diisi angka yang valid dan tidak boleh negatif.');
      return;
    }
    if (formMinStock < 0 || formCurrentStock < 0) {
      setFormError('Nilai stok minimum dan stok awal tidak boleh negatif.');
      return;
    }

    const marginNum = parseFloat(formMarginPercent) || 0;
    const eceranNum = parseFloat(formPriceEceran) || 0;
    const grosirNum = parseFloat(formPriceGrosir) || 0;
    const partaiNum = parseFloat(formPricePartai) || 0;

    const priceData = {
      unitPrice: costNum,
      costPrice: costNum,
      profitMarginPercent: marginNum,
      priceEceran: eceranNum,
      priceGrosir: grosirNum,
      pricePartai: partaiNum,
      priceTiers: {
        eceran: eceranNum,
        grosir: grosirNum,
        partai: partaiNum,
      },
    };

    const stockGudangNum = Number(formStockGudang) || 0;
    const stockPiranhaNum = Number(formStockPiranha) || 0;
    const stockTokoNum = Number(formStockToko) || 0;
    const totalCurrentStock = editingItem
      ? stockGudangNum + stockPiranhaNum + stockTokoNum
      : stockGudangNum + stockPiranhaNum + stockTokoNum || Number(formCurrentStock);
    const isiPerDusNum = Math.max(1, Number(formIsiPerDus) || 1);

    if (editingItem) {
      onUpdateItem({
        ...editingItem,
        sku: formSku.trim(),
        name: formName.trim(),
        category: formCategory.trim() || 'Umum',
        unit: formUnit.trim() || 'pcs',
        merk: formMerk.trim() || '-',
        brand: formMerk.trim() || '-',
        minStock: Number(formMinStock),
        currentStock: totalCurrentStock,
        stockGudang: stockGudangNum,
        stockGudangUtama: stockGudangNum,
        stockPiranha: stockPiranhaNum,
        stockGudangPiranha: stockPiranhaNum,
        stockToko: stockTokoNum,
        isiPerDus: isiPerDusNum,
        location: formLocation.trim() || 'Gudang',
        notes: formNotes.trim() || undefined,
        lastUpdated: new Date().toISOString(),
        ...priceData,
      });
    } else {
      onAddItem({
        sku: formSku.trim(),
        name: formName.trim(),
        category: formCategory.trim() || 'Umum',
        unit: formUnit.trim() || 'pcs',
        merk: formMerk.trim() || '-',
        brand: formMerk.trim() || '-',
        minStock: Number(formMinStock),
        currentStock: totalCurrentStock,
        stockGudang: stockGudangNum,
        stockGudangUtama: stockGudangNum,
        stockPiranha: stockPiranhaNum,
        stockGudangPiranha: stockPiranhaNum,
        stockToko: stockTokoNum,
        isiPerDus: isiPerDusNum,
        location: formLocation.trim() || 'Gudang',
        notes: formNotes.trim() || undefined,
        ...priceData,
      });
    }

    setIsModalOpen(false);
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.location || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;

    let matchesStock = true;
    if (stockStatusFilter === 'OUT') {
      matchesStock = item.currentStock === 0;
    } else if (stockStatusFilter === 'LOW') {
      matchesStock = item.currentStock > 0 && item.currentStock <= item.minStock;
    } else if (stockStatusFilter === 'SAFE') {
      matchesStock = item.currentStock > item.minStock;
    }

    return matchesSearch && matchesCategory && matchesStock;
  });

  return (
    <div className="space-y-6">
      {/* Header and Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Stock List</h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Daftar SKU lengkap dengan harga modal, persentase keuntungan, dan harga jual berjenjang (Eceran, Grosir, Partai).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {activeUser?.username === 'server' && (
            <>
              {onFetchFromSheets && (
                <button
                  onClick={onFetchFromSheets}
                  disabled={isFetchingFromSheets}
                  className="flex items-center space-x-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
                  title="Ambil dan sinkronkan daftar stok langsung dari sheet ' STOCK LIST' di Google Sheets"
                >
                  <Download className={`w-4 h-4 text-indigo-600 ${isFetchingFromSheets ? 'animate-bounce' : ''}`} />
                  <span>{isFetchingFromSheets ? 'Mengambil Data...' : "Tarik dari Sheet 'STOCK LIST'"}</span>
                </button>
              )}
              {onSyncToSheets && (
                <button
                  onClick={onSyncToSheets}
                  disabled={isSyncing}
                  className="flex items-center space-x-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
                  title="Simpan seluruh data produk ke Google Sheets"
                >
                  <RefreshCw className={`w-4 h-4 text-emerald-600 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Menyimpan...' : 'Simpan ke Google Sheets'}</span>
                </button>
              )}
              {spreadsheetUrl && (
                <a
                  href={spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-colors"
                  title="Buka Google Sheets di tab baru"
                >
                  <span>Buka Sheet</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                </a>
              )}
            </>
          )}
          {hasPermission(activeUser, 'master', 'add') && (
            <button
              onClick={openAddModal}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 transition-colors shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Barang Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Sheet Source Indicator Banner (Only for server) */}
      {activeUser?.username === 'server' && (
        <div className="bg-gradient-to-r from-indigo-50 via-teal-50 to-emerald-50 border border-indigo-200/70 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center space-x-2.5 text-indigo-950">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
            <div>
              <span className="font-bold">Sumber Data Google Sheets: </span>
              <code className="bg-white/90 px-2 py-0.5 rounded border border-indigo-200 font-mono text-indigo-800 font-bold text-[11px]">
                " STOCK LIST"
              </code>
              <span className="text-slate-600 ml-1.5 hidden md:inline">
                Data SKU, nama produk, modal, margin %, harga eceran/grosir/partai, &amp; stok dapat ditarik langsung atau diperbarui dari sheet ini.
              </span>
            </div>
          </div>
          {onFetchFromSheets && (
            <button
              onClick={onFetchFromSheets}
              disabled={isFetchingFromSheets}
              className="self-start sm:self-auto flex items-center space-x-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200 shadow-2xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>{isFetchingFromSheets ? 'Memuat...' : 'Muat dari Sheet'}</span>
            </button>
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Cari berdasarkan SKU, Nama Barang, atau Lokasi Rak..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white"
          >
            <option value="ALL">Semua Kategori ({items.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Stock Filter Pills */}
          <div className="flex p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
            <button
              onClick={() => setStockStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                stockStatusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setStockStatusFilter('SAFE')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                stockStatusFilter === 'SAFE' ? 'bg-white text-emerald-700 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Aman
            </button>
            <button
              onClick={() => setStockStatusFilter('LOW')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                stockStatusFilter === 'LOW' ? 'bg-white text-amber-700 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Menipis
            </button>
            <button
              onClick={() => setStockStatusFilter('OUT')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                stockStatusFilter === 'OUT' ? 'bg-white text-rose-700 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Habis
            </button>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-3 py-3.5 whitespace-nowrap">
                  SKU
                </th>
                <th className="px-4 py-3.5 min-w-[180px]">
                  Nama Produk
                </th>
                <th className="px-3 py-3.5 whitespace-nowrap">
                  Kategori
                </th>
                <th className="px-3 py-3.5 text-center whitespace-nowrap">
                  Unit
                </th>
                <th className="px-3 py-3.5 whitespace-nowrap">
                  Merk
                </th>
                <th className="px-3 py-3.5 text-right whitespace-nowrap bg-slate-100/60">
                  <span className="block text-[10px] text-slate-500 font-semibold tracking-wide">HARGA</span>
                  HPP (Modal)
                </th>
                <th className="px-3 py-3.5 text-right whitespace-nowrap text-emerald-800 bg-emerald-50/50">
                  <span className="block text-[10px] text-emerald-600 font-semibold tracking-wide">HARGA</span>
                  Eceran
                </th>
                <th className="px-3 py-3.5 text-right whitespace-nowrap text-indigo-800 bg-indigo-50/50">
                  <span className="block text-[10px] text-indigo-600 font-semibold tracking-wide">HARGA</span>
                  Grosir
                </th>
                <th className="px-3 py-3.5 text-right whitespace-nowrap text-amber-800 bg-amber-50/50">
                  <span className="block text-[10px] text-amber-600 font-semibold tracking-wide">HARGA</span>
                  Partai
                </th>
                <th className="px-3 py-3.5 text-center whitespace-nowrap bg-blue-50/40 border-l border-blue-100 text-blue-900">
                  <span className="block text-[10px] text-blue-600 font-semibold tracking-wide">STOK</span>
                  Gudang
                </th>
                <th className="px-3 py-3.5 text-center whitespace-nowrap bg-amber-50/40 border-l border-amber-100 text-amber-900">
                  <span className="block text-[10px] text-amber-600 font-semibold tracking-wide">STOK</span>
                  Toko
                </th>
                <th className="px-3 py-3.5 text-center whitespace-nowrap bg-teal-50/40 border-l border-teal-100 text-teal-900">
                  <span className="block text-[10px] text-teal-600 font-semibold tracking-wide">STOK</span>
                  Piranha
                </th>
                <th className="px-3 py-3.5 text-center whitespace-nowrap border-l border-slate-200">
                  Total Stok
                </th>
                <th className="px-3 py-3.5 text-center whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center py-12 text-slate-600">
                    <Boxes className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">Tidak ada barang yang cocok</p>
                    <p className="text-xs">Coba ubah kata kunci pencarian atau filter status stok.</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
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
                  const cost = item.costPrice ?? item.unitPrice ?? 0;
                  const eceran = item.priceEceran ?? item.priceTiers?.eceran ?? 0;
                  const grosir = item.priceGrosir ?? item.priceTiers?.grosir ?? 0;
                  const partai = item.pricePartai ?? item.priceTiers?.partai ?? 0;
                  const merk = item.merk || item.brand || '-';

                  return (
                    <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Kolom 1: SKU */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setViewingDetailItem(item)}
                          className="font-mono font-bold text-slate-900 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 px-2 py-1 rounded-lg border border-slate-200 transition-all flex items-center space-x-1.5 cursor-pointer group/sku shadow-2xs"
                          title="Klik untuk melihat detail lengkap sesuai sheet 'STOCK LIST'"
                        >
                          <span>{item.sku}</span>
                          <Eye className="w-3 h-3 text-slate-400 group-hover/sku:text-indigo-600 transition-colors" />
                        </button>
                      </td>

                      {/* Kolom 3: Nama Produk */}
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setViewingDetailItem(item)}
                          className="text-left font-bold text-slate-900 hover:text-indigo-600 transition-colors leading-snug cursor-pointer block group/name"
                          title="Klik untuk melihat detail SKU"
                        >
                          <span className="group-hover/name:underline">{item.name}</span>
                        </button>
                        {item.notes && (
                          <p className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">{item.notes}</p>
                        )}
                      </td>

                      {/* Kolom 7: Kategori */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="inline-block bg-slate-100 text-slate-700 text-[11px] px-2 py-0.5 rounded font-medium">
                          {item.category}
                        </span>
                      </td>

                      {/* Kolom 4: Unit */}
                      <td className="px-3 py-3 text-center whitespace-nowrap font-semibold text-slate-700">
                        {item.unit || 'pcs'}
                      </td>

                      {/* Kolom 9: Merk */}
                      <td className="px-3 py-3 whitespace-nowrap font-medium text-slate-800">
                        {merk}
                      </td>

                      {/* Kolom 10: HPP (Modal) */}
                      <td className="px-3 py-3 text-right font-semibold text-slate-900 whitespace-nowrap bg-slate-50/50">
                        {formatRupiah(cost)}
                      </td>

                      {/* Kolom 13: Eceran */}
                      <td className="px-3 py-3 text-right font-bold text-emerald-700 whitespace-nowrap bg-emerald-50/30">
                        {formatRupiah(eceran)}
                      </td>

                      {/* Kolom 14: Grosir */}
                      <td className="px-3 py-3 text-right font-medium text-indigo-700 whitespace-nowrap bg-indigo-50/30">
                        {formatRupiah(grosir)}
                      </td>

                      {/* Kolom 15: Partai */}
                      <td className="px-3 py-3 text-right font-medium text-amber-700 whitespace-nowrap bg-amber-50/30">
                        {formatRupiah(partai)}
                      </td>

                      {/* Kolom 17: Stok Gudang */}
                      <td className="px-3 py-3 text-center whitespace-nowrap bg-blue-50/30 border-l border-blue-100/70">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-extrabold bg-blue-100/80 text-blue-900">
                          {formatNumber(stockGudang)}
                        </span>
                      </td>

                      {/* Kolom 18: Stok Toko */}
                      <td className="px-3 py-3 text-center whitespace-nowrap bg-amber-50/30 border-l border-amber-100/70">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-extrabold bg-amber-100/80 text-amber-900">
                          {formatNumber(stockToko)}
                        </span>
                      </td>

                      {/* Kolom 19: Stok Piranha */}
                      <td className="px-3 py-3 text-center whitespace-nowrap bg-teal-50/30 border-l border-teal-100/70">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-extrabold bg-teal-100/80 text-teal-900">
                          {formatNumber(stockPiranha)}
                        </span>
                      </td>

                      {/* Total Stock */}
                      <td className="px-3 py-3 text-center whitespace-nowrap border-l border-slate-200">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-extrabold ${
                            totalStock <= 0
                              ? 'bg-rose-100 text-rose-800'
                              : totalStock <= item.minStock
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {formatNumber(totalStock)} {item.unit}
                        </span>
                      </td>

                      {/* Aksi Cepat */}
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => setViewingDetailItem(item)}
                            title="Lihat Detail SKU (Sheet STOCK LIST)"
                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {hasPermission(activeUser, 'history_in', 'add') && (
                            <button
                              onClick={() => onOpenTransactionModal('IN', item.id)}
                              title="Catat Barang Masuk (+)"
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors cursor-pointer"
                            >
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {hasPermission(activeUser, 'history_out', 'add') && (
                            <button
                              onClick={() => onOpenTransactionModal('OUT', item.id)}
                              disabled={item.currentStock <= 0}
                              title={item.currentStock <= 0 ? 'Stok kosong' : 'Catat Barang Keluar (-)'}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                item.currentStock <= 0
                                  ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                              }`}
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {hasPermission(activeUser, 'master', 'edit') && (
                            <button
                              onClick={() => openEditModal(item)}
                              title="Edit Data Barang"
                              className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {hasPermission(activeUser, 'master', 'delete') && (
                            <button
                              onClick={() => onDeleteItem(item.id)}
                              title="Hapus Barang (Destructive)"
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div 
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-item-title"
            className="bg-white rounded-3xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden my-8 animate-in zoom-in-95 duration-150"
          >
            <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5 text-emerald-400" />
                <h3 id="modal-item-title" className="text-base font-bold">
                  {editingItem ? 'Edit Data Master Barang' : 'Tambah Master Barang Baru'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                aria-label="Tutup modal"
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-medium">
                  {formError}
                </div>
              )}

              {/* Basic Info: SKU, Category, Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sku-field" className="block font-bold text-slate-700 mb-1">
                    Kode SKU <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="sku-field"
                    type="text"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="category-field" className="block font-bold text-slate-700 mb-1">
                    Kategori <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="category-field"
                    type="text"
                    placeholder="cth: Elektronik, ATK, Suku Cadang"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="item-name-field" className="block font-bold text-slate-700 mb-1">
                  Nama Lengkap Barang <span className="text-rose-500">*</span>
                </label>
                <input
                  id="item-name-field"
                  type="text"
                  placeholder="cth: Kabel LAN UTP Cat6 305M Belden Original"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white"
                />
              </div>

              {/* Unit, Merk, Isi Per Dus & Min Stock */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="unit-field" className="block font-bold text-slate-700 mb-1">
                    Satuan / Unit <span className="text-[10px] text-slate-400 font-normal">(Kol. 4)</span>
                  </label>
                  <input
                    id="unit-field"
                    type="text"
                    placeholder="pcs, roll, box, rim"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="merk-field" className="block font-bold text-slate-700 mb-1">
                    Merk / Brand <span className="text-[10px] text-slate-400 font-normal">(Kol. 9)</span>
                  </label>
                  <input
                    id="merk-field"
                    type="text"
                    placeholder="cth: Belden, TP-Link"
                    value={formMerk}
                    onChange={(e) => setFormMerk(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:bg-white"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="isi-per-dus-field" className="block font-bold text-slate-700">
                      Isi Per Dus <span className="text-emerald-600 font-semibold text-xs">📦</span>
                    </label>
                  </div>
                  <input
                    id="isi-per-dus-field"
                    type="number"
                    min="1"
                    placeholder="1"
                    value={formIsiPerDus}
                    onChange={(e) => setFormIsiPerDus(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:bg-white"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Isi per karton/dus</span>
                </div>
                <div>
                  <label htmlFor="min-stock-field" className="block font-bold text-slate-700 mb-1">
                    Stok Minimal
                  </label>
                  <input
                    id="min-stock-field"
                    type="number"
                    min="0"
                    step="any"
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:bg-white"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Alert stok menipis</span>
                </div>
              </div>

              {/* Pemisahan Stok Per Gudang (Gudang, Piranha, Toko) */}
              <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
                    Pemisahan Stok Per Gudang / Lokasi
                  </span>
                  <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    Total: {Number((Number(formStockGudang) + Number(formStockPiranha) + Number(formStockToko)).toFixed(4))} {formUnit}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-white border border-slate-200 rounded-xl">
                    <label htmlFor="stock-gudang-field" className="block font-bold text-xs text-slate-800 mb-1">
                      🏢 Stok Gudang
                    </label>
                    <input
                      id="stock-gudang-field"
                      type="number"
                      min="0"
                      step="any"
                      value={formStockGudang}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setFormStockGudang(val);
                        setFormCurrentStock(val + Number(formStockPiranha) + Number(formStockToko));
                      }}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm text-slate-900 focus:bg-white"
                    />
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded-xl">
                    <label htmlFor="stock-piranha-field" className="block font-bold text-xs text-slate-800 mb-1">
                      🏢 Stok Piranha
                    </label>
                    <input
                      id="stock-piranha-field"
                      type="number"
                      min="0"
                      step="any"
                      value={formStockPiranha}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setFormStockPiranha(val);
                        setFormCurrentStock(Number(formStockGudang) + val + Number(formStockToko));
                      }}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm text-slate-900 focus:bg-white"
                    />
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded-xl">
                    <label htmlFor="stock-toko-field" className="block font-bold text-xs text-slate-800 mb-1">
                      🏪 Stok Toko
                    </label>
                    <input
                      id="stock-toko-field"
                      type="number"
                      min="0"
                      step="any"
                      value={formStockToko}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setFormStockToko(val);
                        setFormCurrentStock(Number(formStockGudang) + Number(formStockPiranha) + val);
                      }}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm text-slate-900 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Pricing Section: Harga Modal & % Keuntungan */}
              <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-emerald-900 font-bold">
                    <Coins className="w-4 h-4 text-emerald-600" />
                    <span>Struktur Harga Modal & % Keuntungan Eceran</span>
                  </div>
                  <span className="text-[11px] text-emerald-700 font-medium">% Keuntungan dihitung dari harga eceran</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="cost-price-field" className="block font-bold text-slate-700">
                        Harga Modal (Rp) <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[11px] text-emerald-700 font-medium">Bisa diinput angka bebas</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 font-semibold">Rp</span>
                      <input
                        id="cost-price-field"
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={formCostPrice}
                        onChange={(e) => handleCostPriceChange(e.target.value)}
                        required
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Bebas diisi angka berapa saja (bulat maupun desimal). Contoh: 25000, 150500, 12500.5.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="margin-field" className="block font-bold text-slate-700">
                        % Keuntungan (Eceran)
                      </label>
                      <div className="flex space-x-1">
                        {[10, 20, 25, 30, 50].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => handleMarginChange(pct)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                              formMarginPercent === String(pct)
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        id="margin-field"
                        type="number"
                        step="any"
                        placeholder="Bebas diinput (cth: 25, 33.5, 75)"
                        value={formMarginPercent}
                        onChange={(e) => handleMarginChange(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-xl font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500"
                      />
                      <span className="absolute right-3 top-2 text-slate-500 font-bold">%</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Bisa diinput angka bebas (desimal/bulat). Menghitung otomatis harga Eceran.
                    </p>
                  </div>
                </div>

                {/* 3 Field Isian: Eceran, Grosir, Partai */}
                {(() => {
                  const numCost = parseFloat(formCostPrice) || 0;
                  const numEceran = parseFloat(formPriceEceran) || 0;
                  const numGrosir = parseFloat(formPriceGrosir) || 0;
                  const numPartai = parseFloat(formPricePartai) || 0;

                  const autoFillAllTiers = () => {
                    const marginNum = parseFloat(formMarginPercent) || 25;
                    const calculated = calculateTierPrices(numCost, marginNum);
                    setFormPriceEceran(String(calculated.eceran));
                    setFormPriceGrosir(String(calculated.grosir));
                    setFormPricePartai(String(calculated.partai));
                  };

                  return (
                    <div className="pt-2 border-t border-emerald-200/60 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div>
                          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                            3 Field Isian Harga Jual: "Eceran", "Grosir", "Partai"
                          </span>
                          <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                            Semua field bisa diisi angka bebas
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={autoFillAllTiers}
                            className="text-[10px] text-emerald-700 font-bold hover:text-emerald-900 hover:underline flex items-center space-x-1"
                            title="Hitung otomatis harga Grosir & Partai berjenjang dari modal dan margin"
                          >
                            <Calculator className="w-3 h-3" />
                            <span>Auto-Kalkulasi 3 Tier</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {/* 1. Field Isian: Eceran */}
                        <div className="bg-white p-3 rounded-xl border-2 border-emerald-400 shadow-xs">
                          <div className="flex items-center justify-between mb-1">
                            <label htmlFor="price-eceran-field" className="block text-xs font-extrabold text-emerald-900">
                              1. Eceran (Satuan) <span className="text-rose-500">*</span>
                            </label>
                            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                              Utama
                            </span>
                          </div>
                          <div className="relative">
                            <span className="absolute left-2.5 top-2 text-slate-400 font-semibold text-xs">Rp</span>
                            <input
                              id="price-eceran-field"
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0"
                              value={formPriceEceran}
                              onChange={(e) => handleEceranChange(e.target.value)}
                              className="w-full pl-8 pr-2.5 py-1.5 bg-emerald-50/30 border border-slate-300 rounded-lg font-bold text-slate-900 text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[10px]">
                            <span className="text-emerald-700 font-bold">
                              Untung: +{formatRupiah(Math.max(0, numEceran - numCost))}
                            </span>
                            <span className="bg-emerald-50 text-emerald-700 px-1 rounded font-bold">
                              +{calculateMarginFromPrices(numCost, numEceran)}%
                            </span>
                          </div>
                        </div>

                        {/* 2. Field Isian: Grosir */}
                        <div className="bg-white p-3 rounded-xl border border-indigo-200 shadow-xs">
                          <div className="flex items-center justify-between mb-1">
                            <label htmlFor="price-grosir-field" className="block text-xs font-extrabold text-indigo-900">
                              2. Grosir (Reseller)
                            </label>
                            <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                              Toko/Mitra
                            </span>
                          </div>
                          <div className="relative">
                            <span className="absolute left-2.5 top-2 text-slate-400 font-semibold text-xs">Rp</span>
                            <input
                              id="price-grosir-field"
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0"
                              value={formPriceGrosir}
                              onChange={(e) => handleGrosirChange(e.target.value)}
                              className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[10px]">
                            <span className="text-indigo-700 font-bold">
                              Untung: +{formatRupiah(Math.max(0, numGrosir - numCost))}
                            </span>
                            <span className="bg-indigo-50 text-indigo-700 px-1 rounded font-bold">
                              +{calculateMarginFromPrices(numCost, numGrosir)}%
                            </span>
                          </div>
                        </div>

                        {/* 3. Field Isian: Partai */}
                        <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs">
                          <div className="flex items-center justify-between mb-1">
                            <label htmlFor="price-partai-field" className="block text-xs font-extrabold text-amber-900">
                              3. Partai (Volume)
                            </label>
                            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                              Koli/Dus
                            </span>
                          </div>
                          <div className="relative">
                            <span className="absolute left-2.5 top-2 text-slate-400 font-semibold text-xs">Rp</span>
                            <input
                              id="price-partai-field"
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0"
                              value={formPricePartai}
                              onChange={(e) => handlePartaiChange(e.target.value)}
                              className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 text-xs focus:bg-white focus:ring-2 focus:ring-amber-500"
                            />
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[10px]">
                            <span className="text-amber-700 font-bold">
                              Untung: +{formatRupiah(Math.max(0, numPartai - numCost))}
                            </span>
                            <span className="bg-amber-50 text-amber-700 px-1 rounded font-bold">
                              +{calculateMarginFromPrices(numCost, numPartai)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Location & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="location-field" className="block font-bold text-slate-700 mb-1">
                    Lokasi Rak / Gudang
                  </label>
                  <select
                    id="location-field"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="GUDANG UTAMA">GUDANG UTAMA</option>
                    <option value="GUDANG PIRANHA">GUDANG PIRANHA</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="notes-field" className="block font-bold text-slate-700 mb-1">
                    Keterangan Tambahan
                  </label>
                  <input
                    id="notes-field"
                    type="text"
                    placeholder="cth: Garansi 1 tahun, per dus isi 10"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:bg-white"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md"
                >
                  {editingItem ? 'Simpan Perubahan' : 'Tambahkan Barang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail SKU Barang Modal (Data sesuai Sheet "STOCK LIST") */}
      <SkuDetailModal
        item={viewingDetailItem}
        isOpen={!!viewingDetailItem}
        onClose={() => setViewingDetailItem(null)}
        onEdit={(item) => {
          setViewingDetailItem(null);
          openEditModal(item);
        }}
        onOpenTransaction={(type, itemId) => {
          setViewingDetailItem(null);
          onOpenTransactionModal(type, itemId);
        }}
        activeUser={activeUser}
      />
    </div>
  );
};
