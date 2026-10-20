import type { Item, Transaction, StockSummary, TransactionType, PriceTiers } from '../types/inventory.js';

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(val: number): string {
  return new Intl.NumberFormat('id-ID').format(val);
}

export function getCurrentDateFormatted(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentTimeFormatted(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function calculateTierPrices(costPrice: number, marginPercent: number): PriceTiers {
  const safeCost = Math.max(0, costPrice);
  const safeMargin = Math.max(0, marginPercent);

  // Eceran: Full margin
  const eceran = Math.round(safeCost * (1 + safeMargin / 100));

  // Grosir: discounted margin (approx ~70% of standard markup)
  const grosirMargin = safeMargin * 0.7;
  const grosir = Math.round(safeCost * (1 + grosirMargin / 100));

  // Partai: volume discount margin (approx ~40% of standard markup)
  const partaiMargin = safeMargin * 0.4;
  const partai = Math.round(safeCost * (1 + partaiMargin / 100));

  return { eceran, grosir, partai };
}

export function calculateMarginFromPrices(costPrice: number, sellingPrice: number): number {
  if (costPrice <= 0) return 0;
  return Math.round(((sellingPrice - costPrice) / costPrice) * 100 * 10) / 10;
}

export function calculateStockSummary(items: Item[], transactions: Transaction[], referenceDate?: string): StockSummary {
  const today = referenceDate || getCurrentDateFormatted();
  const currentMonth = today.slice(0, 7); // YYYY-MM

  const totalItems = items.length;
  let totalStockQuantity = 0;
  let totalStockValue = 0;
  let lowStockItemsCount = 0;
  let outOfStockItemsCount = 0;

  for (const item of items) {
    const cost = item.costPrice ?? item.unitPrice ?? 0;
    totalStockQuantity += item.currentStock;
    totalStockValue += item.currentStock * cost;
    if (item.currentStock <= 0) {
      outOfStockItemsCount++;
    } else if (item.currentStock <= item.minStock) {
      lowStockItemsCount++;
    }
  }

  let todayInQuantity = 0;
  let todayOutQuantity = 0;
  let todayInValue = 0;
  let todayOutValue = 0;
  let thisMonthInQuantity = 0;
  let thisMonthOutQuantity = 0;

  for (const tx of transactions) {
    const isToday = tx.date === today;
    const isThisMonth = tx.date.startsWith(currentMonth);

    if (tx.type === 'IN') {
      if (isToday) {
        todayInQuantity += tx.quantity;
        todayInValue += tx.totalPrice;
      }
      if (isThisMonth) {
        thisMonthInQuantity += tx.quantity;
      }
    } else if (tx.type === 'OUT') {
      if (isToday) {
        todayOutQuantity += tx.quantity;
        todayOutValue += tx.totalPrice;
      }
      if (isThisMonth) {
        thisMonthOutQuantity += tx.quantity;
      }
    }
  }

  return {
    totalItems,
    totalStockQuantity,
    totalStockValue,
    lowStockItemsCount,
    outOfStockItemsCount,
    todayInQuantity,
    todayOutQuantity,
    todayInValue,
    todayOutValue,
    thisMonthInQuantity,
    thisMonthOutQuantity,
  };
}

export function validateStockOut(currentStock: number, requestQuantity: number): {
  valid: boolean;
  message?: string;
  remainingStock: number;
} {
  if (requestQuantity <= 0) {
    return {
      valid: false,
      message: 'Jumlah barang harus lebih besar dari 0.',
      remainingStock: currentStock,
    };
  }

  if (requestQuantity > currentStock) {
    return {
      valid: false,
      message: `Stok tidak mencukupi! Tersedia hanya ${currentStock}, permintaan ${requestQuantity}.`,
      remainingStock: currentStock - requestQuantity,
    };
  }

  return {
    valid: true,
    remainingStock: currentStock - requestQuantity,
  };
}

export function getStockGudang(item: Item): number {
  return (
    item.stockGudang ??
    item.stockGudangUtama ??
    (item.location?.includes('Piranha') || item.location?.includes('Toko') ? 0 : item.currentStock)
  );
}

export function getStockPiranha(item: Item): number {
  return (
    item.stockPiranha ??
    item.stockGudangPiranha ??
    (item.location?.includes('Piranha') ? item.currentStock : 0)
  );
}

export function getStockToko(item: Item): number {
  return item.stockToko ?? (item.location?.includes('Toko') ? item.currentStock : 0);
}

export function applyTransactionToItem(
  item: Item,
  tx: { type: TransactionType; quantity: number; targetWarehouse?: import('../types/inventory.js').WarehouseLocation }
): Item {
  let stockGudang = getStockGudang(item);
  let stockPiranha = getStockPiranha(item);
  let stockToko = getStockToko(item);

  const target = tx.targetWarehouse;
  const isPiranha = target === 'Piranha' || target === 'Gudang Piranha';
  const isToko = target === 'Toko';
  const isGudang = !isPiranha && !isToko; // 'Gudang', 'Gudang Utama', or unspecified default

  if (tx.type === 'IN') {
    if (isPiranha) {
      stockPiranha += tx.quantity;
    } else if (isToko) {
      stockToko += tx.quantity;
    } else {
      stockGudang += tx.quantity;
    }
  } else {
    // For OUT, reduce from targeted warehouse or deduct from Gudang, then Piranha, then Toko
    if (isPiranha) {
      stockPiranha = Math.max(0, stockPiranha - tx.quantity);
    } else if (isToko) {
      stockToko = Math.max(0, stockToko - tx.quantity);
    } else if (target === 'Gudang' || target === 'Gudang Utama') {
      stockGudang = Math.max(0, stockGudang - tx.quantity);
    } else {
      // Default: deduct from Gudang first, then Piranha, then Toko
      let remaining = tx.quantity;
      if (stockGudang >= remaining) {
        stockGudang -= remaining;
        remaining = 0;
      } else {
        remaining -= stockGudang;
        stockGudang = 0;
        if (stockPiranha >= remaining) {
          stockPiranha -= remaining;
          remaining = 0;
        } else {
          remaining -= stockPiranha;
          stockPiranha = 0;
          stockToko = Math.max(0, stockToko - remaining);
        }
      }
    }
  }

  const newStock = stockGudang + stockPiranha + stockToko;

  return {
    ...item,
    currentStock: newStock,
    stockGudang,
    stockGudangUtama: stockGudang, // maintain backwards-compat
    stockPiranha,
    stockGudangPiranha: stockPiranha, // maintain backwards-compat
    stockToko,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Reverts the stock change caused by a transaction when that transaction is deleted.
 * - Deleting an IN transaction reduces the stock (as the received goods are revoked).
 * - Deleting an OUT transaction restores the stock (as the discharged goods are returned).
 */
export function revertTransactionFromItem(
  item: Item,
  tx: { type: TransactionType; quantity: number; targetWarehouse?: import('../types/inventory.js').WarehouseLocation }
): Item {
  let stockGudang = getStockGudang(item);
  let stockPiranha = getStockPiranha(item);
  let stockToko = getStockToko(item);

  const target = tx.targetWarehouse;
  const isPiranha = target === 'Piranha' || target === 'Gudang Piranha';
  const isToko = target === 'Toko';

  if (tx.type === 'IN') {
    if (isPiranha) {
      stockPiranha = Math.max(0, stockPiranha - tx.quantity);
    } else if (isToko) {
      stockToko = Math.max(0, stockToko - tx.quantity);
    } else {
      stockGudang = Math.max(0, stockGudang - tx.quantity);
    }
  } else {
    if (isPiranha) {
      stockPiranha += tx.quantity;
    } else if (isToko) {
      stockToko += tx.quantity;
    } else {
      stockGudang += tx.quantity;
    }
  }

  const newStock = stockGudang + stockPiranha + stockToko;

  return {
    ...item,
    currentStock: newStock,
    stockGudang,
    stockGudangUtama: stockGudang,
    stockPiranha,
    stockGudangPiranha: stockPiranha,
    stockToko,
    lastUpdated: new Date().toISOString(),
  };
}

export function filterTransactions(
  transactions: Transaction[],
  filters: {
    type?: 'ALL' | 'IN' | 'OUT';
    search?: string;
    startDate?: string;
    endDate?: string;
    category?: string;
  }
): Transaction[] {
  return transactions.filter((tx) => {
    if (filters.type && filters.type !== 'ALL' && tx.type !== filters.type) {
      return false;
    }
    if (filters.category && filters.category !== 'ALL' && tx.category !== filters.category) {
      return false;
    }
    if (filters.startDate && tx.date < filters.startDate) {
      return false;
    }
    if (filters.endDate && tx.date > filters.endDate) {
      return false;
    }
    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      const matchSku = tx.sku.toLowerCase().includes(q);
      const matchName = tx.itemName.toLowerCase().includes(q);
      const matchPartner = (tx.recipientOrSupplier || '').toLowerCase().includes(q);
      const matchDoc = (tx.referenceDoc || '').toLowerCase().includes(q);
      const matchOperator = (tx.operator || '').toLowerCase().includes(q);
      if (!matchSku && !matchName && !matchPartner && !matchDoc && !matchOperator) {
        return false;
      }
    }
    return true;
  });
}

// Map Item to Google Sheets Row with Cost Price, % Keuntungan Eceran, and Tiers
// Kolom 1: SKU, Kolom 3: Nama Produk, Kolom 4: Unit, Kolom 7: Kategori, Kolom 9: Merk,
// Kolom 10: HPP, Kolom 13: Eceran, Kolom 14: Grosir, Kolom 15: Partai,
// Kolom 17: Stok Gudang, Kolom 18: Stok Toko, Kolom 19: Stok Piranha
export const ITEM_SHEET_HEADERS = [
  'SKU', // Kolom 1
  'ID Sistem', // Kolom 2
  'Nama Produk', // Kolom 3
  'Unit', // Kolom 4
  'Isi Per Dus', // Kolom 5
  'Stok Minimum', // Kolom 6
  'Kategori Produk', // Kolom 7
  'Lokasi Rak', // Kolom 8
  'Merk', // Kolom 9
  'HPP', // Kolom 10
  '% Margin Keuntungan', // Kolom 11
  'Status Stok', // Kolom 12
  'Eceran', // Kolom 13
  'Grosir', // Kolom 14
  'Partai', // Kolom 15
  'Total Stok', // Kolom 16
  'Stok Gudang', // Kolom 17
  'Stok Toko', // Kolom 18
  'Stok Piranha', // Kolom 19
  'Total Nilai Modal (Rp)', // Kolom 20
  'Catatan', // Kolom 21
  'Terakhir Update', // Kolom 22
];

export function itemToSheetRow(item: Item): (string | number)[] {
  const cost = item.costPrice ?? item.unitPrice ?? 0;
  const eceran = item.priceEceran ?? item.priceTiers?.eceran ?? cost;
  const grosir = item.priceGrosir ?? item.priceTiers?.grosir ?? cost;
  const partai = item.pricePartai ?? item.priceTiers?.partai ?? cost;
  // % Keuntungan is strictly computed from Eceran vs Modal
  const margin = calculateMarginFromPrices(cost, eceran);

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
  const statusStok =
    totalStock <= 0 ? 'HABIS' : totalStock <= item.minStock ? 'MENIPIS' : 'AMAN';

  return [
    item.sku, // Kolom 1
    item.id, // Kolom 2
    item.name, // Kolom 3
    item.unit || 'pcs', // Kolom 4
    item.isiPerDus || 1, // Kolom 5
    item.minStock ?? 5, // Kolom 6
    item.category || 'Umum', // Kolom 7
    item.location || 'Gudang', // Kolom 8
    item.merk || item.brand || '-', // Kolom 9
    cost, // Kolom 10 (HPP)
    `${margin}%`, // Kolom 11
    statusStok, // Kolom 12
    eceran, // Kolom 13 (Eceran)
    grosir, // Kolom 14 (Grosir)
    partai, // Kolom 15 (Partai)
    totalStock, // Kolom 16
    stockGudang, // Kolom 17 (Gudang)
    stockToko, // Kolom 18 (Toko)
    stockPiranha, // Kolom 19 (Piranha)
    totalStock * cost, // Kolom 20
    item.notes || '-', // Kolom 21
    item.lastUpdated, // Kolom 22
  ];
}

// Map Transaction to Google Sheets Row
export const TRANSACTION_SHEET_HEADERS = [
  'ID Transaksi',
  'Tanggal',
  'Waktu',
  'Jenis Transaksi',
  'SKU',
  'Nama Barang',
  'Kategori',
  'Jumlah Qty',
  'Satuan',
  'Harga Satuan (Rp)',
  'Total Nilai (Rp)',
  'Pemasok / Penerima',
  'No. Dokumen Ref',
  'Petugas PIC',
  'Keterangan',
];

export function transactionToSheetRow(tx: Transaction): (string | number)[] {
  return [
    tx.id,
    tx.date,
    tx.time,
    tx.type === 'IN' ? 'BARANG MASUK' : 'BARANG KELUAR',
    tx.sku,
    tx.itemName,
    tx.category,
    tx.quantity,
    tx.unit,
    tx.unitPrice,
    tx.totalPrice,
    tx.recipientOrSupplier,
    tx.referenceDoc || '-',
    tx.operator,
    tx.notes || '-',
  ];
}

export function exportTransactionsToCsv(transactions: Transaction[]): string {
  const headers = TRANSACTION_SHEET_HEADERS.join(',');
  const rows = transactions.map((t) => {
    const row = transactionToSheetRow(t).map((val) => {
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    });
    return row.join(',');
  });
  return [headers, ...rows].join('\n');
}

// Customer Sheet Headers and Mappers
export const CUSTOMER_SHEET_HEADERS = [
  'ID Customer',
  'Kode Customer',
  'Nama Pelanggan/Toko',
  'Kategori Tier',
  'Metode Pembayaran',
  'Termin Kredit',
  'No. WhatsApp / HP',
  'Email',
  'Kota / Wilayah',
  'Alamat Pengiriman',
  'Catatan Khusus',
  'Tanggal Dibuat',
  'Terakhir Update',
];

export function customerToSheetRow(c: import('../types/inventory.js').Customer): (string | number)[] {
  return [
    c.id,
    c.code,
    c.name,
    c.type,
    c.paymentMethod || 'CASH',
    c.paymentMethod === 'KREDIT' ? (c.creditTerm || '-') : '-',
    c.phone,
    c.email || '-',
    c.city || '-',
    c.address,
    c.notes || '-',
    c.createdAt,
    c.lastUpdated,
  ];
}

// Supplier Sheet Headers and Mappers
export const SUPPLIER_SHEET_HEADERS = [
  'ID Supplier',
  'Kode Supplier',
  'Nama Pemasok / Distributor',
  'No. Telepon / WhatsApp',
  'Email',
  'Kontak PIC',
  'Kota / Wilayah',
  'Alamat Lengkap',
  'Catatan Tambahan',
  'Tanggal Dibuat',
  'Terakhir Update',
];

export function supplierToSheetRow(s: import('../types/inventory.js').Supplier): (string | number)[] {
  return [
    s.id,
    s.code,
    s.name,
    s.phone,
    s.email || '-',
    s.contactPerson || '-',
    s.city || '-',
    s.address,
    s.notes || '-',
    s.createdAt,
    s.lastUpdated,
  ];
}

// Summary Sheet Headers and Mappers
export const SUMMARY_SHEET_HEADERS = [
  'Indikator Gudang & Inventaris',
  'Nilai / Jumlah',
  'Keterangan',
];

export function summaryToSheetRows(
  summary: StockSummary,
  itemsCount: number,
  customersCount: number,
  suppliersCount: number
): (string | number)[][] {
  return [
    ['Total Master Produk (SKU)', itemsCount, 'Jumlah jenis SKU produk terdaftar'],
    ['Total Kuantitas Fisik Barang', `${summary.totalStockQuantity} Unit`, 'Total akumulasi stok di seluruh gudang'],
    ['Total Estimasi Nilai Modal Aset', formatRupiah(summary.totalStockValue), 'Total nilai barang berdasarkan harga modal'],
    ['Jumlah Produk Menipis (<= Stok Min)', summary.lowStockItemsCount, 'Perlu segera dilakukan pemesanan ulang'],
    ['Jumlah Produk Habis (0)', summary.outOfStockItemsCount, 'Stok kosong di seluruh gudang'],
    ['Total Barang Masuk Hari Ini', `${summary.todayInQuantity} Unit`, 'Penerimaan barang per hari ini'],
    ['Total Nilai Barang Masuk Hari Ini', formatRupiah(summary.todayInValue), 'Nilai nominal pembelian masuk hari ini'],
    ['Total Barang Keluar Hari Ini', `${summary.todayOutQuantity} Unit`, 'Pengeluaran/penjualan barang per hari ini'],
    ['Total Nilai Barang Keluar Hari Ini', formatRupiah(summary.todayOutValue), 'Nilai nominal penjualan keluar hari ini'],
    ['Total Database Pelanggan', customersCount, 'Data pelanggan / toko terdaftar'],
    ['Total Database Supplier', suppliersCount, 'Data distributor / vendor terdaftar'],
    ['Waktu Terakhir Sinkronisasi', new Date().toLocaleString('id-ID'), 'Sinkronisasi otomatis sistem Global Mart'],
  ];
}

export function filterCustomers(
  customers: import('../types/inventory.js').Customer[],
  searchTerm: string,
  typeFilter?: string
): import('../types/inventory.js').Customer[] {
  const q = searchTerm.toLowerCase().trim();
  return customers.filter((cust) => {
    const matchesSearch =
      !q ||
      cust.code.toLowerCase().includes(q) ||
      cust.name.toLowerCase().includes(q) ||
      cust.phone.toLowerCase().includes(q) ||
      (cust.email || '').toLowerCase().includes(q) ||
      cust.address.toLowerCase().includes(q) ||
      (cust.city || '').toLowerCase().includes(q) ||
      (cust.notes || '').toLowerCase().includes(q);

    const matchesType = !typeFilter || typeFilter === 'ALL' || cust.type === typeFilter;
    return matchesSearch && matchesType;
  });
}

export function calculateDueDate(dateStr: string, paymentMethod?: string, creditTerm?: string): string {
  if (!dateStr) return '';
  if (paymentMethod !== 'KREDIT' || !creditTerm) return dateStr;

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  let days = 0;
  if (creditTerm.includes('7')) days = 7;
  else if (creditTerm.includes('14')) days = 14;
  else if (creditTerm.includes('30')) days = 30;
  else if (creditTerm.includes('45')) days = 45;
  else if (creditTerm.includes('60')) days = 60;
  else {
    const num = parseInt(creditTerm, 10);
    if (!isNaN(num)) days = num;
  }

  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

