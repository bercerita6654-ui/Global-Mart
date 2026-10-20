import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateStockSummary,
  validateStockOut,
  applyTransactionToItem,
  revertTransactionFromItem,
  filterTransactions,
  itemToSheetRow,
  transactionToSheetRow,
  formatRupiah,
  calculateTierPrices,
  calculateMarginFromPrices,
  filterCustomers,
  customerToSheetRow,
} from './inventory.ts';
import type { Item, Transaction, Customer } from '../types/inventory.js';

const mockItems: Item[] = [
  {
    id: 'item-1',
    sku: 'EL-001',
    name: 'Kabel UTP Cat6 305M',
    category: 'Elektronik & Jaringan',
    unit: 'roll',
    minStock: 5,
    currentStock: 12,
    unitPrice: 850000,
    costPrice: 850000,
    profitMarginPercent: 20,
    priceEceran: 1020000,
    priceGrosir: 969000,
    pricePartai: 918000,
    location: 'Rak B2',
    lastUpdated: '2026-10-15T10:00:00Z',
  },
  {
    id: 'item-2',
    sku: 'EL-002',
    name: 'Konektor RJ45 Cat6 (Isi 50)',
    category: 'Elektronik & Jaringan',
    unit: 'box',
    minStock: 10,
    currentStock: 3, // Low stock
    unitPrice: 95000,
    costPrice: 95000,
    profitMarginPercent: 25,
    priceEceran: 118750,
    priceGrosir: 111625,
    pricePartai: 104500,
    location: 'Rak B3',
    lastUpdated: '2026-10-15T11:00:00Z',
  },
  {
    id: 'item-3',
    sku: 'OF-001',
    name: 'Kertas HVS A4 80gr',
    category: 'Alat Tulis Kantor',
    unit: 'rim',
    minStock: 20,
    currentStock: 0, // Out of stock
    unitPrice: 52000,
    costPrice: 52000,
    profitMarginPercent: 15,
    priceEceran: 59800,
    priceGrosir: 57460,
    pricePartai: 55120,
    location: 'Gudang Depan',
    lastUpdated: '2026-10-15T12:00:00Z',
  },
];

const mockTransactions: Transaction[] = [
  {
    id: 'tx-1',
    date: '2026-10-16',
    time: '09:00',
    type: 'IN',
    itemId: 'item-1',
    sku: 'EL-001',
    itemName: 'Kabel UTP Cat6 305M',
    category: 'Elektronik & Jaringan',
    quantity: 5,
    unit: 'roll',
    unitPrice: 850000,
    totalPrice: 4250000,
    recipientOrSupplier: 'PT Global Network',
    referenceDoc: 'PO-2026-001',
    operator: 'Budi Santoso',
    createdAt: '2026-10-16T09:00:00Z',
  },
  {
    id: 'tx-2',
    date: '2026-10-16',
    time: '14:30',
    type: 'OUT',
    itemId: 'item-2',
    sku: 'EL-002',
    itemName: 'Konektor RJ45 Cat6 (Isi 50)',
    category: 'Elektronik & Jaringan',
    quantity: 2,
    unit: 'box',
    unitPrice: 95000,
    totalPrice: 190000,
    recipientOrSupplier: 'Divisi IT Support',
    referenceDoc: 'WO-8821',
    operator: 'Siti Aminah',
    createdAt: '2026-10-16T14:30:00Z',
  },
];

test('calculateTierPrices calculates eceran, grosir, and partai prices', () => {
  const modal = 100000;
  const margin = 20; // 20%
  const tiers = calculateTierPrices(modal, margin);

  assert.equal(tiers.eceran, 120000); // 100k + 20%
  assert.equal(tiers.grosir, 114000); // 100k + (20% * 0.7 = 14%)
  assert.equal(tiers.partai, 108000); // 100k + (20% * 0.4 = 8%)
});

test('calculateMarginFromPrices calculates percentage correctly', () => {
  const margin = calculateMarginFromPrices(100000, 125000);
  assert.equal(margin, 25);
});

test('calculateStockSummary computes correct metrics', () => {
  const summary = calculateStockSummary(mockItems, mockTransactions, '2026-10-16');
  assert.equal(summary.totalItems, 3);
  assert.equal(summary.totalStockQuantity, 15); // 12 + 3 + 0
  assert.equal(summary.lowStockItemsCount, 1); // item-2 (3 <= 10)
  assert.equal(summary.outOfStockItemsCount, 1); // item-3 (0)
  assert.equal(summary.todayInQuantity, 5);
  assert.equal(summary.todayOutQuantity, 2);
  assert.equal(summary.todayInValue, 4250000);
  assert.equal(summary.todayOutValue, 190000);
});

test('validateStockOut catches insufficient stock', () => {
  const resultFail = validateStockOut(5, 8);
  assert.equal(resultFail.valid, false);
  assert.ok(resultFail.message?.includes('Stok tidak mencukupi'));
  assert.equal(resultFail.remainingStock, -3);

  const resultZero = validateStockOut(5, 0);
  assert.equal(resultZero.valid, false);

  const resultSuccess = validateStockOut(10, 4);
  assert.equal(resultSuccess.valid, true);
  assert.equal(resultSuccess.remainingStock, 6);
});

test('applyTransactionToItem updates stock correctly', () => {
  const updatedIn = applyTransactionToItem(mockItems[0], { type: 'IN', quantity: 5 });
  assert.equal(updatedIn.currentStock, 17);

  const updatedOut = applyTransactionToItem(mockItems[0], { type: 'OUT', quantity: 4 });
  assert.equal(updatedOut.currentStock, 8);
});

test('revertTransactionFromItem restores previous stock correctly', () => {
  // item-1 current stock is 12
  // If an IN transaction of 5 is deleted, stock decreases back to 7
  const revertedIn = revertTransactionFromItem(mockItems[0], { type: 'IN', quantity: 5 });
  assert.equal(revertedIn.currentStock, 7);

  // If an OUT transaction of 4 is deleted, stock increases back to 16
  const revertedOut = revertTransactionFromItem(mockItems[0], { type: 'OUT', quantity: 4 });
  assert.equal(revertedOut.currentStock, 16);
});

test('filterTransactions filters by type and search query', () => {
  const inOnly = filterTransactions(mockTransactions, { type: 'IN' });
  assert.equal(inOnly.length, 1);
  assert.equal(inOnly[0].id, 'tx-1');

  const outOnly = filterTransactions(mockTransactions, { type: 'OUT' });
  assert.equal(outOnly.length, 1);
  assert.equal(outOnly[0].id, 'tx-2');

  const searchSku = filterTransactions(mockTransactions, { search: 'EL-001' });
  assert.equal(searchSku.length, 1);
  assert.equal(searchSku[0].sku, 'EL-001');

  const searchOperator = filterTransactions(mockTransactions, { search: 'Siti' });
  assert.equal(searchOperator.length, 1);
  assert.equal(searchOperator[0].operator, 'Siti Aminah');
});

test('row mappers generate proper arrays for Google Sheets including tiers', () => {
  const rowItem = itemToSheetRow(mockItems[0]);
  assert.equal(rowItem[0], 'EL-001'); // Kolom 1: SKU
  assert.equal(rowItem[1], 'item-1'); // Kolom 2: ID Sistem
  assert.equal(rowItem[2], 'Kabel UTP Cat6 305M'); // Kolom 3: Nama Produk
  assert.equal(rowItem[3], 'roll'); // Kolom 4: Unit
  assert.equal(rowItem[4], 1); // Kolom 5: Isi Per Dus
  assert.equal(rowItem[6], 'Elektronik & Jaringan'); // Kolom 7: Kategori Produk
  assert.equal(rowItem[9], 850000); // Kolom 10: HPP
  assert.equal(rowItem[10], '20%'); // Kolom 11: % Margin
  assert.equal(rowItem[12], 1020000); // Kolom 13: Eceran
  assert.equal(rowItem[13], 969000); // Kolom 14: Grosir
  assert.equal(rowItem[14], 918000); // Kolom 15: Partai
  assert.equal(rowItem[15], 12); // Kolom 16: Total Stok

  const rowTx = transactionToSheetRow(mockTransactions[0]);
  assert.equal(rowTx[0], 'tx-1');
  assert.equal(rowTx[3], 'BARANG MASUK');
  assert.equal(rowTx[7], 5); // qty
});

test('formatRupiah formats Indonesian currency format', () => {
  const formatted = formatRupiah(1500000);
  assert.ok(formatted.includes('1.500.000') || formatted.includes('Rp'));
});

test('filterCustomers and customerToSheetRow work correctly', () => {
  const mockCustomers: Customer[] = [
    {
      id: 'c-1',
      code: 'CST-001',
      name: 'Toko Komputer Maju',
      phone: '08123456789',
      address: 'Jl. Mangga No. 1',
      city: 'Jakarta',
      type: 'Grosir',
      paymentMethod: 'KREDIT',
      creditTerm: '14 Hari',
      createdAt: '2026-10-16T08:00:00Z',
      lastUpdated: '2026-10-16T08:00:00Z',
    },
    {
      id: 'c-2',
      code: 'CST-002',
      name: 'PT Aneka Jaya',
      phone: '085711223344',
      address: 'Kawasan Industri',
      city: 'Surabaya',
      type: 'Partai',
      paymentMethod: 'CASH',
      createdAt: '2026-10-16T08:00:00Z',
      lastUpdated: '2026-10-16T08:00:00Z',
    },
  ];

  const searchResult = filterCustomers(mockCustomers, 'Surabaya');
  assert.equal(searchResult.length, 1);
  assert.equal(searchResult[0].code, 'CST-002');

  const filterType = filterCustomers(mockCustomers, '', 'Grosir');
  assert.equal(filterType.length, 1);
  assert.equal(filterType[0].code, 'CST-001');

  const sheetRow = customerToSheetRow(mockCustomers[0]);
  assert.equal(sheetRow[0], 'c-1');
  assert.equal(sheetRow[1], 'CST-001');
  assert.equal(sheetRow[2], 'Toko Komputer Maju');
  assert.equal(sheetRow[3], 'Grosir');
  assert.equal(sheetRow[4], 'KREDIT');
  assert.equal(sheetRow[5], '14 Hari');
});

test('findStockListSheetTitle finds matching sheet with or without leading spaces', async () => {
  const { findStockListSheetTitle } = await import('../services/googleSheets.ts');
  assert.equal(findStockListSheetTitle(['Sheet1', ' STOCK LIST', 'Sheet3']), ' STOCK LIST');
  assert.equal(findStockListSheetTitle(['Sheet1', 'STOCK LIST', 'Sheet3']), 'STOCK LIST');
  assert.equal(findStockListSheetTitle(['Sheet1', 'Stock List - 2026']), 'Stock List - 2026');
  assert.equal(findStockListSheetTitle(['Sheet1', 'DATA_BARANG']), 'DATA_BARANG');
});

test('parseRowsToItems parses sheet rows correctly into Item objects with exact column indices', async () => {
  const { parseRowsToItems } = await import('../services/googleSheets.ts');
  const headers = [
    'SKU', // Kolom 1
    'ID Sistem', // Kolom 2
    'Nama Produk', // Kolom 3
    'Unit', // Kolom 4
    'Isi Per Dus', // Kolom 5
    'Stok Minimum', // Kolom 6
    'Kategori Produk', // Kolom 7
    'Lokasi', // Kolom 8
    'Merk', // Kolom 9
    'HPP', // Kolom 10
    '% Margin', // Kolom 11
    'Status', // Kolom 12
    'Eceran', // Kolom 13
    'Grosir', // Kolom 14
    'Partai', // Kolom 15
    'Total Stok', // Kolom 16
    'Gudang', // Kolom 17
    'Toko', // Kolom 18
    'Piranha', // Kolom 19
  ];
  const rows = [
    [
      'BRG-001', // Kolom 1: SKU
      'id-1', // Kolom 2: ID
      'Kopi Robusta 250g', // Kolom 3: Nama Produk
      'pack', // Kolom 4: Unit
      1, // Kolom 5: Isi Dus
      5, // Kolom 6: Min Stok
      'Minuman', // Kolom 7: Kategori Produk
      'Rak A1', // Kolom 8: Lokasi
      'Kapal Api', // Kolom 9: Merk
      25000, // Kolom 10: HPP
      '28%', // Kolom 11: % Margin
      'AMAN', // Kolom 12: Status
      32000, // Kolom 13: Eceran
      30400, // Kolom 14: Grosir
      28800, // Kolom 15: Partai
      35, // Kolom 16: Total Stok
      20, // Kolom 17: Gudang
      5, // Kolom 18: Toko
      10, // Kolom 19: Piranha
    ],
    [
      'BRG-002',
      'id-2',
      'Gula Pasir 1kg',
      'kg',
      1,
      10,
      'Sembako',
      'Rak B1',
      'Gulaku',
      16000,
      '15%',
      'AMAN',
      18500,
      17500,
      16800,
      50,
      50,
      0,
      0,
    ],
  ];

  const items = parseRowsToItems(headers, rows);
  assert.equal(items.length, 2);
  assert.equal(items[0].sku, 'BRG-001');
  assert.equal(items[0].name, 'Kopi Robusta 250g');
  assert.equal(items[0].unit, 'pack');
  assert.equal(items[0].category, 'Minuman');
  assert.equal(items[0].merk, 'Kapal Api');
  assert.equal(items[0].costPrice, 25000);
  assert.equal(items[0].priceEceran, 32000);
  assert.equal(items[0].priceGrosir, 30400);
  assert.equal(items[0].pricePartai, 28800);
  assert.equal(items[0].stockGudang, 20);
  assert.equal(items[0].stockToko, 5);
  assert.equal(items[0].stockPiranha, 10);
  assert.equal(items[0].currentStock, 35);

  assert.equal(items[1].sku, 'BRG-002');
  assert.equal(items[1].name, 'Gula Pasir 1kg');
  assert.equal(items[1].category, 'Sembako');
  assert.equal(items[1].merk, 'Gulaku');
  assert.equal(items[1].currentStock, 50);
});
