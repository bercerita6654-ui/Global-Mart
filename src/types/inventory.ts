export type TransactionType = 'IN' | 'OUT';

export type CustomerType = 'Eceran' | 'Grosir' | 'Partai';

export type PaymentMethod = 'CASH' | 'KREDIT';
export type CreditTerm = '7 Hari' | '14 Hari' | '30 Hari';

export const SALES_REPRESENTATIVES = [
  'Jefri Budi Santoso',
  'Komang Budiarta',
  'Ni Komang Puja Priantini',
  'Nikolas',
  'Muh. Rasyid Ridho',
] as const;

export const SALES_PERSONS = SALES_REPRESENTATIVES;

export type SalesPerson = (typeof SALES_REPRESENTATIVES)[number];

export interface Customer {
  id: string;
  code: string; // Kode Customer, cth: CST-001
  name: string; // Nama Pelanggan / Toko / Perusahaan
  phone: string; // Nomor Kontak / WhatsApp
  email?: string;
  address: string; // Alamat Pengiriman / Toko
  city?: string; // Kota / Wilayah
  type: CustomerType; // Kategori: Eceran, Grosir, Partai
  paymentMethod?: PaymentMethod; // CASH atau KREDIT
  creditTerm?: CreditTerm; // 7 Hari, 14 Hari, 30 Hari jika KREDIT
  salesPerson?: string; // Nama Sales Penanggung Jawab
  notes?: string; // Keterangan tambahan (cth: TOP 14 hari, langganan)
  createdAt: string;
  lastUpdated: string;
}

export interface Supplier {
  id: string;
  code: string; // Kode Supplier, cth: SUP-001
  name: string; // Nama Supplier / Distributor / Vendor
  phone: string; // Nomor Telepon / WhatsApp
  email?: string;
  address: string; // Alamat Gudang / Kantor Supplier
  city?: string; // Kota
  contactPerson?: string; // Nama PIC Sales / Pengelola Supplier
  notes?: string; // Catatan tambahan (cth: Tempo 30 hari, supplier kabel)
  createdAt: string;
  lastUpdated: string;
}

export interface PriceTiers {
  eceran: number; // Harga Jual Eceran
  grosir: number; // Harga Jual Grosir
  partai: number; // Harga Jual Partai
}

export type WarehouseLocation = 'Gudang' | 'Piranha' | 'Toko' | 'Gudang Utama' | 'Gudang Piranha';

export interface Item {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string; // pcs, box, roll, kg, unit, set
  minStock: number;
  currentStock: number;
  stockGudang?: number; // Stok terpisah Gudang
  stockGudangUtama?: number; // legacy alias
  stockPiranha?: number; // Stok terpisah Piranha
  stockGudangPiranha?: number; // legacy alias
  stockToko?: number; // Stok terpisah Toko
  isiPerDus?: number; // Jumlah isi per dus / karton
  unitPrice: number; // Harga Modal / Pokok (in IDR)
  costPrice?: number; // Harga Modal (alias of unitPrice)
  profitMarginPercent?: number; // % Margin Keuntungan (misal 20%)
  priceTiers?: PriceTiers;
  priceEceran?: number; // Harga Jual Eceran
  priceGrosir?: number; // Harga Jual Grosir
  pricePartai?: number; // Harga Jual Partai
  merk?: string; // Merk / Brand (Kolom 9)
  brand?: string; // Alias of merk
  location?: string; // Gudang | Piranha | Toko
  notes?: string;
  lastUpdated: string;
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  type: TransactionType;
  targetWarehouse?: WarehouseLocation; // Gudang Utama atau Gudang Piranha (khususnya untuk Barang Masuk)
  itemId: string;
  sku: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  priceTierUsed?: 'modal' | 'eceran' | 'grosir' | 'partai' | 'custom';
  recipientOrSupplier: string; // Supplier (for IN), Penerima/Divisi/Customer (for OUT)
  referenceDoc?: string; // No PO, No DO, Surat Jalan
  operator: string; // Nama Petugas Gudang
  salesPerson?: string; // Nama Sales pada Penjualan
  paymentMethod?: PaymentMethod; // CASH atau KREDIT
  creditTerm?: CreditTerm; // 7 Hari, 14 Hari, 30 Hari
  notes?: string;
  createdAt: string;
}

export const TARGET_SPREADSHEET_ID = '1olil_je3rWoIn3SdZSO6kHIHGNxbUOtl7BphNTjxeRs';
export const TARGET_SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1olil_je3rWoIn3SdZSO6kHIHGNxbUOtl7BphNTjxeRs/edit?gid=0#gid=0';
export const TARGET_SPREADSHEET_TITLE = 'GLOBAL MART - Master Data & Mutasi Gudang';

export interface SpreadsheetConfig {
  spreadsheetId: string;
  spreadsheetTitle: string;
  spreadsheetUrl: string;
  lastSyncedAt: string | null;
  autoSync: boolean;
  sheets: {
    itemsSheet: string;
    transactionsSheet: string;
  };
}

export interface StockSummary {
  totalItems: number;
  totalStockQuantity: number;
  totalStockValue: number;
  lowStockItemsCount: number;
  outOfStockItemsCount: number;
  todayInQuantity: number;
  todayOutQuantity: number;
  todayInValue: number;
  todayOutValue: number;
  thisMonthInQuantity: number;
  thisMonthOutQuantity: number;
}
