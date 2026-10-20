import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  Calendar,
  Clock,
  UserCheck,
  FileText,
  AlertCircle,
  Building2,
  Check,
  Layers,
  Coins,
  Tag,
  Users,
  Printer,
  Download,
} from 'lucide-react';
import type {
  Item,
  Transaction,
  TransactionType,
  Customer,
  Supplier,
  CustomerType,
  PaymentMethod,
  CreditTerm,
  WarehouseLocation,
} from '../types/inventory.js';
import { SALES_PERSONS } from '../types/inventory.js';
import {
  getCurrentDateFormatted,
  getCurrentTimeFormatted,
  formatRupiah,
  formatNumber,
  validateStockOut,
  calculateTierPrices,
  calculateDueDate,
} from '../utils/inventory.js';
import { generateNotaPdf } from '../utils/pdfGenerator.js';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Item[];
  customers?: Customer[];
  suppliers?: Supplier[];
  transactions?: Transaction[];
  defaultType?: TransactionType;
  preselectedItemId?: string;
  initialRecipient?: string;
  defaultOperator?: string;
  onSubmit: (transactionData: Omit<Transaction, 'id' | 'createdAt'>) => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  items,
  customers = [],
  suppliers = [],
  transactions = [],
  defaultType = 'IN',
  preselectedItemId,
  initialRecipient = '',
  defaultOperator = 'Admin Gudang',
  onSubmit,
}) => {
  const [type, setType] = useState<TransactionType>(defaultType);
  const [selectedItemId, setSelectedItemId] = useState<string>(preselectedItemId || (items[0]?.id || ''));
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedTier, setSelectedTier] = useState<'eceran' | 'grosir' | 'partai' | 'custom'>('eceran');
  const [customPrice, setCustomPrice] = useState<number>(0);
  const [salesPerson, setSalesPerson] = useState<string>(SALES_PERSONS[0]);
  const [paymentType, setPaymentType] = useState<PaymentMethod>('CASH');
  const [creditTerm, setCreditTerm] = useState<CreditTerm>('14 Hari');
  const [targetWarehouse, setTargetWarehouse] = useState<WarehouseLocation>('Gudang');
  const [date, setDate] = useState<string>(getCurrentDateFormatted());
  const [time, setTime] = useState<string>(getCurrentTimeFormatted());
  const [recipientOrSupplier, setRecipientOrSupplier] = useState<string>('');
  const [referenceDoc, setReferenceDoc] = useState<string>('');
  const [operator, setOperator] = useState<string>(defaultOperator);
  const [notes, setNotes] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [showInvoicePreview, setShowInvoicePreview] = useState<boolean>(false);

  const currentItem = items.find((i) => i.id === selectedItemId);
  const currentStock = currentItem?.currentStock ?? 0;
  const unit = currentItem?.unit || 'pcs';

  const costPrice = currentItem?.costPrice ?? currentItem?.unitPrice ?? 0;
  const margin = currentItem?.profitMarginPercent ?? 20;
  const tiers = calculateTierPrices(costPrice, margin);
  const eceranPrice = currentItem?.priceEceran ?? currentItem?.priceTiers?.eceran ?? tiers.eceran;
  const grosirPrice = currentItem?.priceGrosir ?? currentItem?.priceTiers?.grosir ?? tiers.grosir;
  const partaiPrice = currentItem?.pricePartai ?? currentItem?.priceTiers?.partai ?? tiers.partai;

  // Determine active unit price based on transaction type
  let activeUnitPrice = costPrice;
  if (type === 'OUT') {
    activeUnitPrice = customPrice;
  } else {
    // Inbound: buying at cost or custom
    activeUnitPrice = customPrice > 0 ? customPrice : costPrice;
  }

  const totalPrice = activeUnitPrice * (quantity || 0);

  // Konsolidasi data customer dari Master Customer DAN Database Penjualan (transaksi OUT)
  const connectedCustomersList = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        code?: string;
        type?: CustomerType;
        salesPerson?: string;
        paymentMethod?: PaymentMethod;
        creditTerm?: CreditTerm;
        salesCount: number;
        source: 'master' | 'database_penjualan' | 'both';
      }
    >();

    // 1. Masukkan seluruh Master Data Customer
    customers.forEach((c) => {
      const key = c.name.trim().toLowerCase();
      map.set(key, {
        id: c.id,
        name: c.name.trim(),
        code: c.code,
        type: c.type,
        salesPerson: c.salesPerson,
        paymentMethod: c.paymentMethod,
        creditTerm: c.creditTerm,
        salesCount: 0,
        source: 'master',
      });
    });

    // 2. Telusuri Database Penjualan (transaksi OUT)
    const outTx = transactions.filter((tx) => tx.type === 'OUT' && tx.recipientOrSupplier);
    outTx.forEach((tx) => {
      const trimmed = tx.recipientOrSupplier.trim();
      const key = trimmed.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.salesCount += 1;
        if (existing.source === 'master') {
          existing.source = 'both';
        }
        if (tx.salesPerson) {
          existing.salesPerson = tx.salesPerson;
        }
        if (!existing.paymentMethod && tx.paymentMethod) {
          existing.paymentMethod = tx.paymentMethod;
        }
        if (!existing.creditTerm && tx.creditTerm) {
          existing.creditTerm = tx.creditTerm;
        }
      } else {
        map.set(key, {
          id: `db-cust-${key}`,
          name: trimmed,
          salesPerson: tx.salesPerson,
          salesCount: 1,
          source: 'database_penjualan',
          paymentMethod: tx.paymentMethod,
          creditTerm: tx.creditTerm,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, transactions]);

  // Track customer match info
  const matchedCustomerInfo = useMemo(() => {
    if (!recipientOrSupplier.trim()) return null;
    const searchKey = recipientOrSupplier.trim().toLowerCase();
    return connectedCustomersList.find((c) => c.name.toLowerCase() === searchKey) || null;
  }, [recipientOrSupplier, connectedCustomersList]);

  useEffect(() => {
    if (isOpen) {
      setType(defaultType);
      setShowInvoicePreview(false);
      if (preselectedItemId) {
        setSelectedItemId(preselectedItemId);
      } else if (items.length > 0 && !selectedItemId) {
        setSelectedItemId(items[0].id);
      }
      setDate(getCurrentDateFormatted());
      setTime(getCurrentTimeFormatted());
      setQuantity(1);
      setErrorMsg('');

      if (initialRecipient) {
        setRecipientOrSupplier(initialRecipient);
        const match = connectedCustomersList.find(
          (c) =>
            c.name.toLowerCase() === initialRecipient.toLowerCase() ||
            (c.code && c.code.toLowerCase() === initialRecipient.toLowerCase())
        );
        if (match) {
          if (match.type === 'Eceran') setSelectedTier('eceran');
          else if (match.type === 'Grosir') setSelectedTier('grosir');
          else if (match.type === 'Partai') setSelectedTier('partai');
          if (match.salesPerson) setSalesPerson(match.salesPerson);
          if (match.paymentMethod) setPaymentType(match.paymentMethod);
          if (match.creditTerm) setCreditTerm(match.creditTerm);
        } else {
          setSelectedTier('eceran');
        }
      } else {
        setRecipientOrSupplier('');
        setSelectedTier('eceran');
      }
    }
  }, [isOpen, defaultType, preselectedItemId, initialRecipient, items, connectedCustomersList]);

  useEffect(() => {
    if (currentItem) {
      setCustomPrice(type === 'IN' ? costPrice : eceranPrice);
    }
  }, [selectedItemId, type]);

  if (!isOpen) return null;

  // Validation
  const stockValidation = type === 'OUT' 
    ? validateStockOut(currentStock, quantity || 0)
    : { valid: true, remainingStock: currentStock + (quantity || 0) };

  const executeSaveTransaction = () => {
    if (!currentItem) return;
    onSubmit({
      date,
      time,
      type,
      itemId: currentItem.id,
      sku: currentItem.sku,
      itemName: currentItem.name,
      category: currentItem.category,
      quantity,
      unit: currentItem.unit,
      unitPrice: activeUnitPrice,
      totalPrice,
      priceTierUsed: type === 'OUT' ? selectedTier : 'modal',
      targetWarehouse,
      recipientOrSupplier: recipientOrSupplier.trim(),
      salesPerson: type === 'OUT' ? salesPerson : undefined,
      paymentMethod: type === 'OUT' ? paymentType : undefined,
      creditTerm: type === 'OUT' && paymentType === 'KREDIT' ? creditTerm : undefined,
      referenceDoc: referenceDoc.trim() || undefined,
      operator: operator.trim() || 'Admin Gudang',
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!currentItem) {
      setErrorMsg('Pilih barang terlebih dahulu.');
      return;
    }

    if (!quantity || quantity <= 0) {
      setErrorMsg('Jumlah barang harus lebih dari 0.');
      return;
    }

    if (type === 'OUT' && !stockValidation.valid) {
      setErrorMsg(stockValidation.message || 'Stok tidak mencukupi untuk pengeluaran barang.');
      return;
    }

    if (!recipientOrSupplier.trim()) {
      setErrorMsg(
        type === 'IN'
          ? 'Mohon masukkan nama Pemasok / Supplier.'
          : 'Mohon masukkan nama Pelanggan / Customer.'
      );
      return;
    }

    if (type === 'OUT') {
      setShowInvoicePreview(true);
    } else {
      executeSaveTransaction();
    }
  };

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.category.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-tx-title"
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8 animate-in zoom-in-95 duration-150"
      >
        {/* Header with Type Selector */}
        <div className={`p-6 text-white transition-colors ${
          type === 'IN' 
            ? 'bg-gradient-to-r from-emerald-600 to-teal-600' 
            : 'bg-gradient-to-r from-amber-600 to-rose-600'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
                {type === 'IN' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
              </span>
              <div>
                <h3 id="modal-tx-title" className="text-xl font-bold">
                  {type === 'IN' ? 'Input Barang Masuk (Penerimaan)' : 'Input Penjualan'}
                </h3>
                <p className="text-xs text-white/80">
                  {type === 'IN' ? 'Mencatat stok masuk dari supplier/retur' : 'Mencatat transaksi penjualan pelanggan oleh tim sales'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Tutup form transaksi"
              className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Toggle Tabs */}
          <div className="flex p-1 bg-black/20 rounded-xl max-w-xs">
            <button
              type="button"
              onClick={() => {
                setType('IN');
                setErrorMsg('');
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                type === 'IN' ? 'bg-white text-emerald-800 shadow' : 'text-white/80 hover:text-white'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>BARANG MASUK (+)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setType('OUT');
                setErrorMsg('');
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                type === 'OUT' ? 'bg-white text-rose-800 shadow' : 'text-white/80 hover:text-white'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>PENJUALAN (-)</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="flex items-start space-x-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Item Selector */}
          <div>
            <label htmlFor="select-item" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Pilih Barang / SKU <span className="text-rose-500">*</span>
            </label>
            <div className="space-y-2">
              <select
                id="select-item"
                value={selectedItemId}
                onChange={(e) => {
                  setSelectedItemId(e.target.value);
                  setErrorMsg('');
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                {filteredItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    [{item.sku}] {item.name} — Stok Saat Ini: {item.currentStock} {item.unit}
                  </option>
                ))}
              </select>

              {/* Selected Item Detail Pill with Modal & Price Tiers */}
              {currentItem && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <span className="text-slate-600 block">Kategori</span>
                      <span className="font-semibold text-slate-800">{currentItem.category}</span>
                    </div>
                    <div>
                      <span className="text-slate-600 block">Lokasi Rak</span>
                      <span className="font-semibold text-slate-800">{currentItem.location || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-600 block">Stok Saat Ini</span>
                      <span className={`font-bold ${currentItem.currentStock <= currentItem.minStock ? 'text-amber-600' : 'text-emerald-700'}`}>
                        {formatNumber(currentItem.currentStock)} {currentItem.unit}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-600 block">Harga Modal</span>
                      <span className="font-bold text-slate-900">{formatRupiah(costPrice)}</span>
                    </div>
                  </div>

                  {/* Price Tier Reference */}
                  <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between text-[11px] gap-2">
                    <span className="text-slate-600 font-medium">Stok Terpisah Gudang:</span>
                    <div className="flex space-x-2 font-mono">
                      <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                        Utama: {currentItem.stockGudangUtama ?? (currentItem.location?.includes('Piranha') ? 0 : currentItem.currentStock)} {currentItem.unit}
                      </span>
                      <span className="bg-cyan-50 text-cyan-800 px-2 py-0.5 rounded border border-cyan-200">
                        Piranha: {currentItem.stockGudangPiranha ?? (currentItem.location?.includes('Piranha') ? currentItem.currentStock : 0)} {currentItem.unit}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pilihan Gudang Tujuan untuk Input Barang Masuk (Penerimaan) */}
          {type === 'IN' && (
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900">
                  Gudang Tujuan Penerimaan Barang <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-emerald-700 font-semibold">Pilih lokasi masuk stok:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setTargetWarehouse('Gudang')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    targetWarehouse === 'Gudang' || targetWarehouse === 'Gudang Utama'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-400'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-base">🏢</span>
                    <div>
                      <p className="font-extrabold text-sm">Gudang</p>
                      <p className={`text-[11px] ${targetWarehouse === 'Gudang' || targetWarehouse === 'Gudang Utama' ? 'text-emerald-100' : 'text-slate-500'}`}>
                        Pusat Gudang
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetWarehouse('Piranha')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    targetWarehouse === 'Piranha' || targetWarehouse === 'Gudang Piranha'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-400'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-base">🏢</span>
                    <div>
                      <p className="font-extrabold text-sm">Piranha</p>
                      <p className={`text-[11px] ${targetWarehouse === 'Piranha' || targetWarehouse === 'Gudang Piranha' ? 'text-emerald-100' : 'text-slate-500'}`}>
                        Cabang Piranha
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetWarehouse('Toko')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    targetWarehouse === 'Toko'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-400'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-base">🏪</span>
                    <div>
                      <p className="font-extrabold text-sm">Toko</p>
                      <p className={`text-[11px] ${targetWarehouse === 'Toko' ? 'text-emerald-100' : 'text-slate-500'}`}>
                        Display / Toko
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              {/* Input Harga Satuan (Modal) Barang Masuk */}
              <div className="pt-2 border-t border-emerald-200/80">
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="tx-inbound-cost-price" className="block text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <span>💵 Harga Satuan (Modal) Pembelian: <span className="text-rose-500">*</span></span>
                  </label>
                  <span className="text-[11px] text-emerald-800 font-semibold">
                    Modal sistem saat ini: <strong>{formatRupiah(costPrice)}</strong>
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-500 font-bold text-sm">Rp</span>
                  <input
                    id="tx-inbound-cost-price"
                    type="number"
                    min="0"
                    step="any"
                    placeholder={`Ketik harga modal pembelian bebas (cth: ${costPrice})`}
                    value={customPrice > 0 ? customPrice : ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setCustomPrice(val);
                    }}
                    required
                    className="w-full pl-11 pr-4 py-2.5 bg-white border-2 border-emerald-300 rounded-xl text-base font-extrabold text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400"
                  />
                </div>

                {customPrice > 0 && Math.round(customPrice) !== Math.round(costPrice) ? (
                  <div className="mt-2 p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-extrabold block">Harga Modal Berbeda dari Sebelumnya:</span>
                      <p className="text-[11px] mt-0.5">
                        Harga modal baru ({formatRupiah(customPrice)}) berbeda dari modal master ({formatRupiah(costPrice)}). Stok barang ini akan otomatis <strong>dipisahkan ke varian stok terpisah</strong> di Stock List.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-1">
                    *Harga Satuan (Modal) bisa diketik bebas. Jika harga modal berbeda dari sebelumnya, maka stoknya akan otomatis dipisahkan.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Pricing Selector for Outbound transactions (Harga Modal DIHILANGKAN, Harga Custom 1 Field Bebas) */}
          {type === 'OUT' && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Pilih Kategori Harga Transaksi
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTier('eceran');
                    setCustomPrice(eceranPrice);
                  }}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-all text-left ${
                    selectedTier === 'eceran'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-1 ring-emerald-400'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="block text-[10px] opacity-80 uppercase">Eceran</span>
                  <span className="font-mono text-sm">{formatRupiah(eceranPrice)}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedTier('grosir');
                    setCustomPrice(grosirPrice);
                  }}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-all text-left ${
                    selectedTier === 'grosir'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-1 ring-indigo-400'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="block text-[10px] opacity-80 uppercase">Grosir</span>
                  <span className="font-mono text-sm">{formatRupiah(grosirPrice)}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedTier('partai');
                    setCustomPrice(partaiPrice);
                  }}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-all text-left ${
                    selectedTier === 'partai'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs ring-1 ring-amber-400'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="block text-[10px] opacity-80 uppercase">Partai</span>
                  <span className="font-mono text-sm">{formatRupiah(partaiPrice)}</span>
                </button>
              </div>

              {/* 1 Field Saja untuk Harga Satuan / Harga Custom (Bisa Diisi Angka Bebas) */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="tx-custom-price" className="block text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <span>✏️ Harga Satuan Transaksi (Bisa Diisi Angka Bebas):</span>
                    {selectedTier === 'custom' && (
                      <span className="bg-teal-100 text-teal-800 text-[10px] px-2 py-0.5 rounded-full font-extrabold border border-teal-200">
                        Custom Aktif
                      </span>
                    )}
                  </label>
                  <span className="text-[11px] text-teal-700 font-semibold">
                    {selectedTier === 'custom' ? 'Harga custom sedang dipakai' : 'Ketik angka bebas di bawah'}
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-500 font-bold text-sm">Rp</span>
                  <input
                    id="tx-custom-price"
                    type="number"
                    min="0"
                    step="any"
                    placeholder={`Masukkan angka nominal bebas (cth: ${activeUnitPrice || 50000})`}
                    value={customPrice > 0 ? customPrice : ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setCustomPrice(val);
                      setSelectedTier('custom');
                    }}
                    className="w-full pl-11 pr-4 py-2 bg-white border-2 border-slate-300 rounded-xl text-base font-extrabold text-slate-900 transition-all focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-400"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  *Anda dapat mengisi angka nominal berapapun secara bebas, atau memilih tombol Eceran, Grosir, atau Partai di atas.
                </p>
              </div>
            </div>
          )}

          {/* Quantity & Stock Calculator */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="tx-quantity" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Jumlah / Quantity ({unit}) <span className="text-rose-500">*</span>
              </label>
              <input
                id="tx-quantity"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => {
                  setQuantity(parseInt(e.target.value, 10) || 0);
                  setErrorMsg('');
                }}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-lg font-bold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Live Calculation Preview */}
            <div className={`p-3 rounded-xl border flex flex-col justify-center ${
              type === 'OUT' && !stockValidation.valid
                ? 'bg-rose-50 border-rose-300 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}>
              <div className="text-xs flex items-center justify-between mb-1">
                <span className="text-slate-600">Simulasi Stok:</span>
                <span className="font-semibold">
                  {currentStock} {type === 'IN' ? '+' : '-'} {quantity || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase">Stok Sesudah:</span>
                <span className={`text-base font-extrabold ${
                  type === 'OUT' && !stockValidation.valid ? 'text-rose-600' : 'text-emerald-700'
                }`}>
                  {stockValidation.remainingStock} {unit}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 mt-1 flex justify-between">
                <span>Harga Satuan ({type === 'OUT' ? (selectedTier === 'custom' ? 'CUSTOM' : selectedTier.toUpperCase()) : 'MODAL'}):</span>
                <span className="font-semibold text-slate-900">{formatRupiah(activeUnitPrice)}</span>
              </div>
              <div className="text-xs font-bold text-slate-900 mt-0.5 flex justify-between border-t border-slate-200/60 pt-1">
                <span>Total Nilai:</span>
                <span className="text-emerald-800 font-extrabold">{formatRupiah(totalPrice)}</span>
              </div>
            </div>
          </div>

          {/* Partner & Reference Doc */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="tx-partner" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  {type === 'IN' ? 'Nama Pemasok / Supplier' : 'Nama Pelanggan / Customer'} <span className="text-rose-500">*</span>
                </label>
                {type === 'OUT' && connectedCustomersList.length > 0 && (
                  <span className="text-[10px] text-emerald-700 font-semibold flex items-center space-x-1">
                    <Users className="w-3 h-3 text-emerald-600" />
                    <span>Database Penjualan & Customer:</span>
                  </span>
                )}
                {type === 'IN' && suppliers.length > 0 && (
                  <span className="text-[10px] text-indigo-700 font-semibold flex items-center space-x-1">
                    <Building2 className="w-3 h-3 text-indigo-600" />
                    <span>Database Supplier:</span>
                  </span>
                )}
              </div>

              {type === 'IN' && suppliers.length > 0 && (
                <div className="mb-2">
                  <select
                    value={suppliers.some((s) => s.name === recipientOrSupplier) ? recipientOrSupplier : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        setRecipientOrSupplier(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 bg-indigo-50/80 border border-indigo-300 rounded-xl text-xs font-semibold text-indigo-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Pilih dari Database Supplier ({suppliers.length} Supplier) --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.name}>
                        [{s.code}] {s.name} • {s.city || 'Indonesia'} {s.contactPerson ? `(PIC: ${s.contactPerson})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {type === 'OUT' && connectedCustomersList.length > 0 && (
                <div className="mb-2">
                  <select
                    value={matchedCustomerInfo?.name || ''}
                    onChange={(e) => {
                      const selectedName = e.target.value;
                      const found = connectedCustomersList.find((c) => c.name === selectedName);
                      if (found) {
                        setRecipientOrSupplier(found.name);
                        if (found.type === 'Eceran') setSelectedTier('eceran');
                        else if (found.type === 'Grosir') setSelectedTier('grosir');
                        else if (found.type === 'Partai') setSelectedTier('partai');

                        // Otomatis koneksikan nama sales dari database
                        if (found.salesPerson) {
                          setSalesPerson(found.salesPerson);
                        }
                        if (found.paymentMethod) setPaymentType(found.paymentMethod);
                        if (found.creditTerm) setCreditTerm(found.creditTerm);
                      } else {
                        setRecipientOrSupplier('');
                      }
                    }}
                    className="w-full px-3 py-2 bg-emerald-50/80 border border-emerald-300 rounded-xl text-xs font-semibold text-emerald-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Pilih Customer ({connectedCustomersList.length} di Database Penjualan) --</option>
                    {connectedCustomersList.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.code ? `[${c.code}] ` : ''}{c.name} {c.type ? `(${c.type})` : ''} • Sales: {c.salesPerson || 'Belum ditugaskan'} {c.salesCount > 0 ? `(${c.salesCount}x Transaksi)` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  id="tx-partner"
                  type="text"
                  placeholder={type === 'IN' ? 'cth: PT Solusi Sejahtera' : 'cth: Toko Maju Jaya / Hendra'}
                  value={recipientOrSupplier}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRecipientOrSupplier(val);
                    if (type === 'OUT' && val.trim().length >= 2) {
                      const matched = connectedCustomersList.find(
                        (c) => c.name.toLowerCase() === val.trim().toLowerCase()
                      );
                      if (matched?.salesPerson) {
                        setSalesPerson(matched.salesPerson);
                      }
                      if (matched?.type) {
                        if (matched.type === 'Eceran') setSelectedTier('eceran');
                        else if (matched.type === 'Grosir') setSelectedTier('grosir');
                        else if (matched.type === 'Partai') setSelectedTier('partai');
                      }
                      if (matched?.paymentMethod) setPaymentType(matched.paymentMethod);
                      if (matched?.creditTerm) setCreditTerm(matched.creditTerm);
                    }
                  }}
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Status Koneksi Sales & Database Pelanggan */}
              {type === 'OUT' && matchedCustomerInfo && (
                <div className="mt-1.5 p-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-[11px] text-emerald-900 animate-in fade-in-50 duration-150">
                  <div className="flex items-center space-x-1.5 overflow-hidden">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">
                      Terkoneksi Database: Sales otomatis dipilih <strong>{matchedCustomerInfo.salesPerson || salesPerson}</strong>
                    </span>
                  </div>
                  <span className="text-[10px] bg-emerald-200/80 text-emerald-900 font-extrabold px-1.5 py-0.5 rounded-sm shrink-0 ml-1">
                    {matchedCustomerInfo.salesCount > 0 ? `${matchedCustomerInfo.salesCount}x Penjualan` : 'Master Customer'}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="tx-refdoc" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                No. Dokumen Ref / Surat Jalan / PO
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  id="tx-refdoc"
                  type="text"
                  placeholder="cth: SJ-2026/10/091, PO-883"
                  value={referenceDoc}
                  onChange={(e) => setReferenceDoc(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Sales Person Selection on Penjualan */}
          {type === 'OUT' && (
            <div className="p-3.5 bg-rose-50/50 border border-rose-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="tx-sales" className="block text-xs font-bold uppercase tracking-wider text-rose-950">
                  Nama Sales Penjualan <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full">
                  5 Tim Sales
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {SALES_PERSONS.map((sales) => (
                  <button
                    key={sales}
                    type="button"
                    onClick={() => setSalesPerson(sales)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border text-left transition-all truncate ${
                      salesPerson === sales
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-rose-50/60'
                    }`}
                  >
                    <span className="truncate block">👤 {sales}</span>
                  </button>
                ))}
              </div>
              <div className="pt-1">
                <select
                  id="tx-sales"
                  value={salesPerson}
                  onChange={(e) => setSalesPerson(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-rose-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                >
                  {SALES_PERSONS.map((s) => (
                    <option key={s} value={s}>
                      Sales: {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Date, Time & Operator */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="tx-date" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Tanggal
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  id="tx-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full pl-9 pr-2 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="tx-time" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Waktu (Jam)
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  id="tx-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  className="w-full pl-9 pr-2 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="tx-operator" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Petugas PIC
              </label>
              <div className="relative">
                <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  id="tx-operator"
                  type="text"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  required
                  className="w-full pl-9 pr-2 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="tx-notes" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Catatan Tambahan (Opsional)
            </label>
            <input
              id="tx-notes"
              type="text"
              placeholder="cth: Kondisi box tersegel rapi, diantar kurir ekspedisi"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-hidden"
            />
          </div>

          {/* Submit & Cancel Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={type === 'OUT' && !stockValidation.valid}
              className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-md transition-all ${
                type === 'OUT' && !stockValidation.valid
                  ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                  : type === 'IN'
                  ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-emerald-500/20'
                  : 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 shadow-rose-500/20'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{type === 'IN' ? 'Simpan Barang Masuk' : 'Lanjut'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Nota Penjualan Preview Modal upon clicking Lanjut */}
      {showInvoicePreview && currentItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex items-center justify-between border-b border-emerald-700">
              <div className="flex items-center space-x-3">
                <span className="p-2 bg-white/20 rounded-xl">
                  <Printer className="w-5 h-5 text-white" />
                </span>
                <div>
                  <h3 className="text-lg font-extrabold tracking-tight">Nota Penjualan</h3>
                  <p className="text-xs text-emerald-200">Pratinjau Nota (Stok belum terpotong sebelum klik Save)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInvoicePreview(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 bg-slate-50">
              <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
                <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Pusat Grosir & Eceran</h2>
                    <p className="text-xs text-slate-500">Jl. Raya Distribusi Utama No. 88, Indonesia</p>
                  </div>
                  <div className="text-right">
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-black uppercase tracking-wider">
                      NOTA PENJUALAN
                    </span>
                    <p className="text-xs font-mono font-bold text-slate-800 mt-2">TRX-OUT-{Date.now().toString().slice(-6)}</p>
                    <p className="text-xs text-slate-500">{date} • {time}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                  <div>
                    <span className="text-slate-500 font-bold block mb-1">KEPADA PELANGGAN:</span>
                    <p className="font-extrabold text-slate-900 text-sm">{recipientOrSupplier}</p>
                    <p className="text-slate-600 mt-0.5">Metode: <strong className="text-slate-900">{paymentType}</strong> {paymentType === 'KREDIT' ? `(${creditTerm})` : ''}</p>
                    <p className="text-slate-600 mt-0.5">Jatuh Tempo: <strong className="text-slate-900 font-mono">{calculateDueDate(date, paymentType, creditTerm)}</strong></p>
                    {referenceDoc && (
                      <p className="text-slate-600 mt-0.5">No. DO/Ref: <strong className="font-mono">{referenceDoc}</strong></p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 font-bold block mb-1">TIM SALES PENANGGUNG JAWAB:</span>
                    <p className="font-extrabold text-rose-700 text-sm">{salesPerson}</p>
                  </div>
                </div>

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
                        <p className="font-extrabold text-slate-900">{currentItem.name}</p>
                        <p className="text-[11px] text-slate-500 font-mono">SKU: {currentItem.sku} • {currentItem.category}</p>
                      </td>
                      <td className="px-3 py-3 text-center font-bold">
                        {formatNumber(quantity)} {currentItem.unit}
                      </td>
                      <td className="px-3 py-3 text-right font-mono">
                        {formatRupiah(activeUnitPrice)}
                      </td>
                      <td className="px-3 py-3 text-right font-extrabold text-slate-900 font-mono">
                        {formatRupiah(totalPrice)}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 font-extrabold text-sm text-slate-900">
                      <td colSpan={3} className="px-3 py-4 text-right">TOTAL PEMBAYARAN:</td>
                      <td className="px-3 py-4 text-right text-emerald-800 text-base font-black font-mono">
                        {formatRupiah(totalPrice)}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Footer Notes & Auto-print notice (No signature column) */}
                <div className="pt-4 border-t border-slate-200 space-y-3 text-xs">
                  <div>
                    <span className="font-bold text-slate-700 block mb-1">Catatan Transaksi:</span>
                    <p className="text-slate-600 italic">{notes || 'Terima kasih atas kepercayaan Anda.'}</p>
                  </div>
                  <div className="pt-3 border-t border-slate-100 text-center text-slate-500 text-[11px] font-medium italic">
                    Nota ini diprint secara otomatis, tidak memerlukan tanda tangan
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowInvoicePreview(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Kembali Edit
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    generateNotaPdf({
                      transactionId: `TRX-OUT-${Date.now().toString().slice(-6)}`,
                      date,
                      time,
                      recipient: recipientOrSupplier,
                      paymentMethod: paymentType,
                      creditTerm: paymentType === 'KREDIT' ? creditTerm : undefined,
                      dueDate: calculateDueDate(date, paymentType, creditTerm),
                      referenceDoc,
                      salesPerson,
                      itemName: currentItem.name,
                      sku: currentItem.sku,
                      category: currentItem.category,
                      quantity,
                      unit: currentItem.unit,
                      unitPrice: activeUnitPrice,
                      totalPrice,
                      notes,
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
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  <span>Print</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    executeSaveTransaction();
                  }}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center space-x-2 shadow-md shadow-rose-600/20"
                >
                  <Check className="w-4 h-4" />
                  <span>Save & Potong Stok</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
