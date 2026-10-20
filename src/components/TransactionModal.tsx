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
  Lock,
  FileSpreadsheet,
  Plus,
  Trash2,
  ShoppingCart,
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

export interface CartItem {
  id: string;
  itemId: string;
  sku: string;
  itemName: string;
  category: string;
  unit: string;
  quantity: number;
  selectedTier: 'eceran' | 'grosir' | 'partai' | 'custom';
  unitPrice: number;
  totalPrice: number;
  currentStock: number;
  targetWarehouse: WarehouseLocation;
}

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Item[];
  customers?: Customer[];
  suppliers?: Supplier[];
  transactions?: Transaction[];
  salesPersons?: string[];
  defaultType?: TransactionType;
  preselectedItemId?: string;
  initialRecipient?: string;
  defaultOperator?: string;
  onSubmit: (transactionData: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onSubmitBatch?: (transactionDataList: Array<Omit<Transaction, 'id' | 'createdAt'>>) => Promise<void> | void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  items,
  customers = [],
  suppliers = [],
  transactions = [],
  salesPersons = [],
  defaultType = 'IN',
  preselectedItemId,
  initialRecipient = '',
  defaultOperator = 'Admin Gudang',
  onSubmit,
  onSubmitBatch,
}) => {
  const activeSalesList = salesPersons && salesPersons.length > 0 ? salesPersons : [...SALES_PERSONS];
  const [type, setType] = useState<TransactionType>(defaultType);
  const [selectedItemId, setSelectedItemId] = useState<string>(preselectedItemId || (items[0]?.id || ''));
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedTier, setSelectedTier] = useState<'eceran' | 'grosir' | 'partai' | 'custom'>('eceran');
  const [customPrice, setCustomPrice] = useState<number>(0);
  const [salesPerson, setSalesPerson] = useState<string>(activeSalesList[0] || 'Sales');
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

  // Real-time clock for Input Penjualan (type === 'OUT') so Tanggal & Waktu cannot be edited and stay strictly live
  useEffect(() => {
    if (!isOpen) return;
    if (type === 'OUT') {
      setDate(getCurrentDateFormatted());
      setTime(getCurrentTimeFormatted());
      const interval = setInterval(() => {
        setDate(getCurrentDateFormatted());
        setTime(getCurrentTimeFormatted());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isOpen, type]);

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

  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Reset cart when modal closes or opens fresh
  useEffect(() => {
    if (!isOpen) {
      setCartItems([]);
      setErrorMsg('');
      setShowInvoicePreview(false);
    }
  }, [isOpen]);

  const handleAddToCart = () => {
    setErrorMsg('');
    if (!currentItem) {
      setErrorMsg('Pilih barang terlebih dahulu.');
      return;
    }
    if (!quantity || quantity <= 0) {
      setErrorMsg('Jumlah barang harus lebih dari 0.');
      return;
    }
    if (!stockValidation.valid) {
      setErrorMsg(stockValidation.message || 'Stok tidak mencukupi untuk pengeluaran barang.');
      return;
    }

    // Check if item already exists in cart with same tier & price
    const existingIndex = cartItems.findIndex(
      (c) => c.itemId === currentItem.id && c.selectedTier === selectedTier && Math.round(c.unitPrice) === Math.round(activeUnitPrice)
    );

    if (existingIndex !== -1) {
      const updated = [...cartItems];
      const newQty = updated[existingIndex].quantity + quantity;
      if (newQty > currentItem.currentStock) {
        setErrorMsg(`Total kuantitas di daftar (${newQty} ${currentItem.unit}) melebihi stok yang tersedia (${currentItem.currentStock} ${currentItem.unit}).`);
        return;
      }
      updated[existingIndex].quantity = newQty;
      updated[existingIndex].totalPrice = newQty * updated[existingIndex].unitPrice;
      setCartItems(updated);
    } else {
      const currentInCart = cartItems
        .filter((c) => c.itemId === currentItem.id)
        .reduce((sum, c) => sum + c.quantity, 0);
      if (currentInCart + quantity > currentItem.currentStock) {
        setErrorMsg(`Total kuantitas barang ini di daftar (${currentInCart + quantity} ${currentItem.unit}) melebihi stok yang tersedia (${currentItem.currentStock} ${currentItem.unit}).`);
        return;
      }

      const newCartItem: CartItem = {
        id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        itemId: currentItem.id,
        sku: currentItem.sku,
        itemName: currentItem.name,
        category: currentItem.category,
        unit: currentItem.unit,
        quantity,
        selectedTier,
        unitPrice: activeUnitPrice,
        totalPrice,
        targetWarehouse,
        currentStock: currentItem.currentStock,
      };
      setCartItems((prev) => [...prev, newCartItem]);
    }

    // Reset quantity to 1 for next SKU selection
    setQuantity(1);
  };

  const handleRemoveFromCart = (cartId: string) => {
    setCartItems((prev) => prev.filter((c) => c.id !== cartId));
  };

  const handleUpdateCartQty = (cartId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveFromCart(cartId);
      return;
    }
    setCartItems((prev) =>
      prev.map((c) => {
        if (c.id === cartId) {
          if (newQty > c.currentStock) return c;
          return {
            ...c,
            quantity: newQty,
            totalPrice: newQty * c.unitPrice,
          };
        }
        return c;
      })
    );
  };

  if (!isOpen) return null;

  // Validation
  const stockValidation = type === 'OUT' 
    ? validateStockOut(currentStock, quantity || 0)
    : { valid: true, remainingStock: currentStock + (quantity || 0) };

  const executeSaveTransaction = async () => {
    if (type === 'OUT' && cartItems.length > 0) {
      const batchList: Array<Omit<Transaction, 'id' | 'createdAt'>> = cartItems.map((cart) => ({
        date,
        time,
        type: 'OUT',
        itemId: cart.itemId,
        sku: cart.sku,
        itemName: cart.itemName,
        category: cart.category,
        quantity: cart.quantity,
        unit: cart.unit,
        unitPrice: cart.unitPrice,
        totalPrice: cart.totalPrice,
        priceTierUsed: cart.selectedTier,
        targetWarehouse: cart.targetWarehouse || targetWarehouse,
        recipientOrSupplier: recipientOrSupplier.trim(),
        salesPerson: salesPerson,
        paymentMethod: paymentType,
        creditTerm: paymentType === 'KREDIT' ? creditTerm : undefined,
        referenceDoc: referenceDoc.trim() || undefined,
        operator: operator.trim() || 'Admin Gudang',
        notes: notes.trim() || undefined,
      }));

      if (onSubmitBatch) {
        await onSubmitBatch(batchList);
      } else {
        for (const itemTx of batchList) {
          onSubmit(itemTx);
        }
      }
      onClose();
      return;
    }

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

    if (!recipientOrSupplier.trim()) {
      setErrorMsg(
        type === 'IN'
          ? 'Mohon masukkan nama Pemasok / Supplier.'
          : 'Mohon masukkan nama Pelanggan / Customer.'
      );
      return;
    }

    if (type === 'OUT') {
      if (cartItems.length > 0) {
        for (const c of cartItems) {
          const it = items.find((i) => i.id === c.itemId);
          if (!it || c.quantity > it.currentStock) {
            setErrorMsg(`Stok untuk [${c.sku}] ${c.itemName} tidak mencukupi (Tersedia: ${it?.currentStock ?? 0}, di daftar: ${c.quantity}).`);
            return;
          }
        }
        setShowInvoicePreview(true);
        return;
      }

      if (!currentItem) {
        setErrorMsg('Pilih minimal 1 barang atau tambahkan ke daftar Multi-SKU.');
        return;
      }
      if (!quantity || quantity <= 0) {
        setErrorMsg('Jumlah barang harus lebih dari 0.');
        return;
      }
      if (!stockValidation.valid) {
        setErrorMsg(stockValidation.message || 'Stok tidak mencukupi untuk pengeluaran barang.');
        return;
      }

      setShowInvoicePreview(true);
    } else {
      if (!currentItem) {
        setErrorMsg('Pilih barang terlebih dahulu.');
        return;
      }
      if (!quantity || quantity <= 0) {
        setErrorMsg('Jumlah barang harus lebih dari 0.');
        return;
      }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-tx-title"
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header with Type Selector (shrink-0 so always visible) */}
        <div className={`p-4 sm:p-5 shrink-0 text-white transition-colors ${
          type === 'IN' 
            ? 'bg-gradient-to-r from-emerald-600 to-teal-600' 
            : 'bg-gradient-to-r from-amber-600 to-rose-600'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
                {type === 'IN' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
              </span>
              <div>
                <h3 id="modal-tx-title" className="text-lg sm:text-xl font-bold">
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

        {/* Form Body (Scrollable flex-1) */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
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

          {/* Multi-SKU Add Button and Cart Table for Penjualan */}
          {type === 'OUT' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-teal-50/70 border border-teal-200 rounded-xl">
                <div className="flex items-center space-x-2">
                  <span className="p-1.5 bg-teal-100 text-teal-800 rounded-lg">
                    <ShoppingCart className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Fitur Multi-SKU Penjualan:
                    </span>
                    <span className="text-[11px] text-slate-600">
                      Ingin menjual beberapa macam produk sekaligus dalam 1 nota? Klik tombol di kanan.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!stockValidation.valid || !quantity || quantity <= 0}
                  className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
                    !stockValidation.valid || !quantity || quantity <= 0
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white shadow-teal-500/20'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Tambah ke Daftar Multi-SKU</span>
                </button>
              </div>

              {cartItems.length > 0 && (
                <div className="p-3.5 bg-white border-2 border-teal-300 rounded-2xl shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="p-1.5 bg-teal-100 text-teal-800 rounded-lg">
                        <ShoppingCart className="w-4 h-4" />
                      </span>
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                          Daftar Barang Multi-SKU ({cartItems.length} Macam SKU)
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Semua item di bawah akan tercatat dalam 1 nota dan memotong stok masing-masing secara otomatis.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCartItems([])}
                      className="text-[11px] text-rose-600 hover:text-rose-800 font-bold hover:underline"
                    >
                      Hapus Semua
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-bold uppercase border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2">Barang & SKU</th>
                          <th className="px-3 py-2 text-center">Tier & Harga</th>
                          <th className="px-3 py-2 text-center">Kuantitas</th>
                          <th className="px-3 py-2 text-right">Subtotal</th>
                          <th className="px-2 py-2 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {cartItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/80">
                            <td className="px-3 py-2.5">
                              <p className="font-extrabold text-slate-900">{item.itemName}</p>
                              <p className="text-[10px] font-mono text-slate-500">
                                SKU: {item.sku} • {item.category}
                              </p>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-teal-50 text-teal-800 border border-teal-200 uppercase mb-0.5">
                                {item.selectedTier}
                              </span>
                              <p className="font-mono text-xs font-semibold text-slate-800">
                                {formatRupiah(item.unitPrice)}
                              </p>
                            </td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              <div className="inline-flex items-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCartQty(item.id, item.quantity - 1)}
                                  className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs"
                                >
                                  -
                                </button>
                                <span className="font-bold font-mono text-slate-900 px-1 text-xs">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCartQty(item.id, item.quantity + 1)}
                                  disabled={item.quantity >= item.currentStock}
                                  className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs disabled:opacity-40"
                                >
                                  +
                                </button>
                                <span className="text-slate-500 text-[10px]">{item.unit}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right font-extrabold font-mono text-emerald-800">
                              {formatRupiah(item.totalPrice)}
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveFromCart(item.id)}
                                className="p-1 rounded text-rose-500 hover:bg-rose-50 transition-colors"
                                title="Hapus barang ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                        <tr>
                          <td colSpan={2} className="px-3 py-2 text-xs">
                            Total Ringkasan: <span className="text-teal-700 font-extrabold">{cartItems.length} Produk</span>
                          </td>
                          <td className="px-3 py-2 text-center text-xs font-extrabold">
                            {formatNumber(cartItems.reduce((acc, c) => acc + c.quantity, 0))} item
                          </td>
                          <td className="px-3 py-2 text-right font-black font-mono text-emerald-900 text-sm">
                            {formatRupiah(cartItems.reduce((acc, c) => acc + c.totalPrice, 0))}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

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
                  {activeSalesList.length} Tim Sales (Sheet &apos;SALES&apos;)
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {activeSalesList.map((sales) => (
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
                  {activeSalesList.map((s) => (
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
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="tx-date" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Tanggal
                </label>
                {type === 'OUT' ? (
                  <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded font-bold flex items-center space-x-1">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Real-time</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500">Penerimaan</span>
                )}
              </div>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  id="tx-date"
                  type="date"
                  value={date}
                  onChange={(e) => {
                    if (type !== 'OUT') setDate(e.target.value);
                  }}
                  readOnly={type === 'OUT'}
                  title={type === 'OUT' ? 'Tanggal mengikuti realtime dan tidak dapat diubah' : 'Pilih tanggal'}
                  required
                  className={`w-full pl-9 pr-2 py-2 border rounded-xl text-xs font-semibold ${
                    type === 'OUT'
                      ? 'bg-slate-100 text-slate-600 border-slate-300 cursor-not-allowed select-none'
                      : 'bg-slate-50 border-slate-300 text-slate-800 focus:bg-white'
                  }`}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="tx-time" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Waktu (Jam)
                </label>
                {type === 'OUT' ? (
                  <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded font-bold flex items-center space-x-1">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Real-time</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500">Waktu Masuk</span>
                )}
              </div>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  id="tx-time"
                  type="time"
                  value={time}
                  onChange={(e) => {
                    if (type !== 'OUT') setTime(e.target.value);
                  }}
                  readOnly={type === 'OUT'}
                  title={type === 'OUT' ? 'Waktu jam mengikuti realtime dan tidak dapat diubah' : 'Pilih jam'}
                  required
                  className={`w-full pl-9 pr-2 py-2 border rounded-xl text-xs font-semibold ${
                    type === 'OUT'
                      ? 'bg-slate-100 text-slate-600 border-slate-300 cursor-not-allowed select-none'
                      : 'bg-slate-50 border-slate-300 text-slate-800 focus:bg-white'
                  }`}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="tx-operator" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Petugas PIC
                </label>
                <span className="text-[10px] text-slate-500">Operator</span>
              </div>
              <div className="relative">
                <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
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

          {/* Auto-Sync to Spreadsheet Notice */}
          <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center space-x-2 text-xs text-emerald-900">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-[11px] leading-tight">
              Otomatis masuk ke spreadsheet pada sheet{' '}
              <strong className="text-emerald-950 underline decoration-emerald-400">
                &quot;{type === 'IN' ? 'HISTORY PEMBELIAN' : 'HISTORY PENJUALAN'}&quot;
              </strong>{' '}
              dan otomatis perbarui stok di sheet{' '}
              <strong className="text-emerald-950 underline decoration-emerald-400">&quot;STOCK LIST&quot;</strong>.
            </span>
          </div>

          {/* Submit & Cancel Buttons (Sticky footer so always visible) */}
          <div className="sticky bottom-0 bg-white/95 backdrop-blur-xs flex items-center justify-between pt-3 pb-1 border-t border-slate-200 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={type === 'OUT' && cartItems.length === 0 && !stockValidation.valid}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white shadow-md transition-all ${
                type === 'OUT' && cartItems.length === 0 && !stockValidation.valid
                  ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                  : type === 'IN'
                  ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-emerald-500/20'
                  : 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 shadow-rose-500/20'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>
                {type === 'IN'
                  ? 'Simpan Barang Masuk'
                  : cartItems.length > 0
                  ? `Lanjut ke Nota (${cartItems.length} SKU)`
                  : 'Lanjut ke Nota'}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* Nota Penjualan Preview Modal upon clicking Lanjut */}
      {showInvoicePreview && (cartItems.length > 0 || currentItem) && (
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
                  <p className="text-xs text-emerald-200">
                    {cartItems.length > 0
                      ? `Pratinjau Multi-SKU (${cartItems.length} Produk) — Stok belum terpotong sebelum klik Save`
                      : 'Pratinjau Nota (Stok belum terpotong sebelum klik Save)'}
                  </p>
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
                    {cartItems.length > 0 ? (
                      cartItems.map((c) => (
                        <tr key={c.id}>
                          <td className="px-3 py-3">
                            <p className="font-extrabold text-slate-900">{c.itemName}</p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              SKU: {c.sku} • {c.category} • <span className="uppercase text-emerald-700 font-bold">{c.selectedTier}</span>
                            </p>
                          </td>
                          <td className="px-3 py-3 text-center font-bold">
                            {formatNumber(c.quantity)} {c.unit}
                          </td>
                          <td className="px-3 py-3 text-right font-mono">
                            {formatRupiah(c.unitPrice)}
                          </td>
                          <td className="px-3 py-3 text-right font-extrabold text-slate-900 font-mono">
                            {formatRupiah(c.totalPrice)}
                          </td>
                        </tr>
                      ))
                    ) : currentItem ? (
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
                    ) : null}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 font-extrabold text-sm text-slate-900">
                      <td colSpan={3} className="px-3 py-4 text-right">
                        TOTAL PEMBAYARAN ({cartItems.length > 0 ? `${cartItems.length} Produk, ${cartItems.reduce((acc, c) => acc + c.quantity, 0)} item` : `${quantity} item`}):
                      </td>
                      <td className="px-3 py-4 text-right text-emerald-800 text-base font-black font-mono">
                        {formatRupiah(cartItems.length > 0 ? cartItems.reduce((acc, c) => acc + c.totalPrice, 0) : totalPrice)}
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
                    const pdfItems = cartItems.length > 0
                      ? cartItems.map((c) => ({
                          itemName: c.itemName,
                          sku: c.sku,
                          category: c.category,
                          quantity: c.quantity,
                          unit: c.unit,
                          unitPrice: c.unitPrice,
                          totalPrice: c.totalPrice,
                        }))
                      : currentItem
                      ? [
                          {
                            itemName: currentItem.name,
                            sku: currentItem.sku,
                            category: currentItem.category,
                            quantity,
                            unit: currentItem.unit,
                            unitPrice: activeUnitPrice,
                            totalPrice,
                          },
                        ]
                      : [];

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
                      notes,
                      items: pdfItems,
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
