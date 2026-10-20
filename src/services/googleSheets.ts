import {
  Item,
  Transaction,
  Customer,
  Supplier,
  TARGET_SPREADSHEET_ID,
  TARGET_SPREADSHEET_URL,
} from '../types/inventory.js';
import {
  ITEM_SHEET_HEADERS,
  TRANSACTION_SHEET_HEADERS,
  CUSTOMER_SHEET_HEADERS,
  SUPPLIER_SHEET_HEADERS,
  SUMMARY_SHEET_HEADERS,
  itemToSheetRow,
  transactionToSheetRow,
  customerToSheetRow,
  supplierToSheetRow,
  summaryToSheetRows,
  calculateStockSummary,
  calculateTierPrices,
} from '../utils/inventory.js';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export interface SyncResult {
  success: boolean;
  message: string;
  updatedAt?: string;
  spreadsheetUrl?: string;
}

export { TARGET_SPREADSHEET_ID, TARGET_SPREADSHEET_URL };

/**
 * Finds the sheet tab matching " STOCK LIST" or "STOCK LIST" (case-insensitive, trimmed)
 * Fallback to DATA_BARANG if neither is found.
 */
export function findStockListSheetTitle(sheetTitles: string[]): string | null {
  // 1. Check exact match for " STOCK LIST"
  const exactLeading = sheetTitles.find((t) => t === ' STOCK LIST');
  if (exactLeading) return exactLeading;

  // 2. Check trimmed match "STOCK LIST"
  const trimmed = sheetTitles.find((t) => t.trim().toUpperCase() === 'STOCK LIST');
  if (trimmed) return trimmed;

  // 3. Check containing STOCK and LIST
  const partial = sheetTitles.find((t) => {
    const upper = t.toUpperCase();
    return upper.includes('STOCK') && upper.includes('LIST');
  });
  if (partial) return partial;

  // 4. Fallback to DATA_BARANG
  const dataBarang = sheetTitles.find((t) => t.trim().toUpperCase() === 'DATA_BARANG');
  if (dataBarang) return dataBarang;

  return null;
}

/**
 * Parses raw text or numeric cell into a clean number
 */
export function parseCleanNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  // Handle formats like "Rp 1.500.000", "1,500.00", "20%"
  const cleanStr = String(val)
    .replace(/Rp|\s|%|\./gi, '')
    .replace(',', '.');
  const n = parseFloat(cleanStr);
  return isNaN(n) ? 0 : n;
}

/**
 * Parses 2D array of rows from Google Sheets into Item objects
 * Adheres strictly to the user's column definition:
 * - Kolom 1 (idx 0): SKU
 * - Kolom 3 (idx 2): Nama Produk
 * - Kolom 7 (idx 6): Kategori Produk
 * - Kolom 4 (idx 3): Unit
 * - Kolom 9 (idx 8): Merk
 * - Kolom 10 (idx 9): HPP
 * - Kolom 13 (idx 12): Eceran
 * - Kolom 14 (idx 13): Grosir
 * - Kolom 15 (idx 14): Partai
 * Stock:
 * - Kolom 17 (idx 16): Gudang
 * - Kolom 18 (idx 17): Toko
 * - Kolom 19 (idx 18): Piranha
 */
export function parseRowsToItems(headers: string[], rows: any[][]): Item[] {
  const findCol = (regex: RegExp) =>
    headers.findIndex((h) => regex.test(String(h || '').trim().toLowerCase()));

  // Dynamic header detections as secondary fallback
  const hSkuCol = findCol(/^sku\b|kode.*barang|^kode$|sku/i);
  const hNameCol = findCol(/^nama\b|nama.*barang|item.*name|deskripsi/i);
  const hCatCol = findCol(/kategori|category/i);
  const hUnitCol = findCol(/satuan|unit/i);
  const hMerkCol = findCol(/merk|brand/i);
  const hHppCol = findCol(/modal|hpp|beli|pokok|cost/i);
  const hEceranCol = findCol(/eceran|retail/i);
  const hGrosirCol = findCol(/grosir/i);
  const hPartaiCol = findCol(/partai/i);
  const hGudangCol = findCol(/gudang.*utama|stok.*gudang|^gudang$/i);
  const hTokoCol = findCol(/toko/i);
  const hPiranhaCol = findCol(/piranha/i);
  const hTotalStockCol = findCol(/total.*stok|sisa|stok.*akhir|^stok$/i);

  const items: Item[] = [];

  rows.forEach((row, idx) => {
    if (!row || row.length === 0) return;

    // 1. SKU (Kolom 1 / idx 0)
    const rawSku =
      row[0] !== undefined && row[0] !== null && String(row[0]).trim() !== ''
        ? String(row[0]).trim()
        : hSkuCol !== -1 && row[hSkuCol]
        ? String(row[hSkuCol]).trim()
        : '';

    // 2. Nama Produk (Kolom 3 / idx 2)
    const rawName =
      row[2] !== undefined && row[2] !== null && String(row[2]).trim() !== ''
        ? String(row[2]).trim()
        : hNameCol !== -1 && row[hNameCol]
        ? String(row[hNameCol]).trim()
        : '';

    // Skip empty or header rows
    if (!rawSku && !rawName) return;
    if (
      rawSku.toUpperCase() === 'SKU' ||
      rawName.toUpperCase() === 'NAMA PRODUK' ||
      rawName.toUpperCase() === 'NAMA BARANG'
    )
      return;
    if (rawSku.toUpperCase().includes('TOTAL') || rawName.toUpperCase().includes('TOTAL')) return;

    const sku = rawSku || `SKU-${String(idx + 1).padStart(3, '0')}`;
    const name = rawName || rawSku;

    // Kolom 2 (idx 1): ID Sistem / Barcode
    const rawId =
      row[1] !== undefined && row[1] !== null && String(row[1]).trim() !== ''
        ? String(row[1]).trim()
        : `item-${sku.toLowerCase().replace(/[^a-z0-9_-]/g, '-') || Date.now()}-${idx + 1}`;
    const id =
      rawId.toUpperCase() === 'ID SISTEM' || rawId.toUpperCase() === 'ID'
        ? `item-${sku}-${idx + 1}`
        : rawId;

    // 3. Unit (Kolom 4 / idx 3)
    const rawUnit =
      row[3] !== undefined && row[3] !== null && String(row[3]).trim() !== ''
        ? String(row[3]).trim()
        : hUnitCol !== -1 && row[hUnitCol]
        ? String(row[hUnitCol]).trim()
        : 'pcs';
    const unit =
      rawUnit.toUpperCase() === 'UNIT' || rawUnit.toUpperCase() === 'SATUAN'
        ? 'pcs'
        : rawUnit || 'pcs';

    // Kolom 5 (idx 4): Isi Per Dus
    const isiPerDus = row[4] !== undefined ? Math.max(1, parseCleanNumber(row[4]) || 1) : 1;

    // Kolom 6 (idx 5): Stok Minimum
    const minStock = row[5] !== undefined ? Math.max(0, parseCleanNumber(row[5])) : 5;

    // 4. Kategori Produk (Kolom 7 / idx 6)
    const rawCat =
      row[6] !== undefined && row[6] !== null && String(row[6]).trim() !== ''
        ? String(row[6]).trim()
        : hCatCol !== -1 && row[hCatCol]
        ? String(row[hCatCol]).trim()
        : 'Umum';
    const category = rawCat.toUpperCase().includes('KATEGORI') ? 'Umum' : rawCat || 'Umum';

    // Kolom 8 (idx 7): Lokasi Rak / Gudang
    const location =
      row[7] !== undefined && row[7] !== null && String(row[7]).trim() !== ''
        ? String(row[7]).trim()
        : 'Gudang';

    // 5. Merk (Kolom 9 / idx 8)
    const rawMerk =
      row[8] !== undefined && row[8] !== null && String(row[8]).trim() !== ''
        ? String(row[8]).trim()
        : hMerkCol !== -1 && row[hMerkCol]
        ? String(row[hMerkCol]).trim()
        : '-';
    const merk = rawMerk.toUpperCase() === 'MERK' || rawMerk.toUpperCase() === 'BRAND' ? '-' : rawMerk;

    // 6. HPP (Kolom 10 / idx 9)
    const costPrice =
      row[9] !== undefined
        ? parseCleanNumber(row[9])
        : hHppCol !== -1
        ? parseCleanNumber(row[hHppCol])
        : 0;

    // Kolom 11 (idx 10): % Margin
    const profitMarginPercent = row[10] !== undefined ? parseCleanNumber(row[10]) : 25;

    // 7. Eceran (Kolom 13 / idx 12)
    let priceEceran =
      row[12] !== undefined
        ? parseCleanNumber(row[12])
        : hEceranCol !== -1
        ? parseCleanNumber(row[hEceranCol])
        : 0;

    // 8. Grosir (Kolom 14 / idx 13)
    let priceGrosir =
      row[13] !== undefined
        ? parseCleanNumber(row[13])
        : hGrosirCol !== -1
        ? parseCleanNumber(row[hGrosirCol])
        : 0;

    // 9. Partai (Kolom 15 / idx 14)
    let pricePartai =
      row[14] !== undefined
        ? parseCleanNumber(row[14])
        : hPartaiCol !== -1
        ? parseCleanNumber(row[hPartaiCol])
        : 0;

    if (priceEceran === 0 && costPrice > 0) {
      const calculatedTiers = calculateTierPrices(costPrice, profitMarginPercent || 25);
      priceEceran = calculatedTiers.eceran;
      priceGrosir = calculatedTiers.grosir;
      pricePartai = calculatedTiers.partai;
    } else {
      if (priceGrosir === 0 && priceEceran > 0) priceGrosir = Math.round(priceEceran * 0.95);
      if (pricePartai === 0 && priceEceran > 0) pricePartai = Math.round(priceEceran * 0.9);
    }

    // Stock:
    // 10. Gudang (Kolom 17 / idx 16)
    const stockGudang =
      row[16] !== undefined
        ? parseCleanNumber(row[16])
        : hGudangCol !== -1
        ? parseCleanNumber(row[hGudangCol])
        : 0;

    // 11. Toko (Kolom 18 / idx 17)
    const stockToko =
      row[17] !== undefined
        ? parseCleanNumber(row[17])
        : hTokoCol !== -1
        ? parseCleanNumber(row[hTokoCol])
        : 0;

    // 12. Piranha (Kolom 19 / idx 18)
    const stockPiranha =
      row[18] !== undefined
        ? parseCleanNumber(row[18])
        : hPiranhaCol !== -1
        ? parseCleanNumber(row[hPiranhaCol])
        : 0;

    let currentStock = stockGudang + stockToko + stockPiranha;
    if (currentStock === 0 && row[15] !== undefined) {
      currentStock = parseCleanNumber(row[15]);
    } else if (currentStock === 0 && hTotalStockCol !== -1 && row[hTotalStockCol]) {
      currentStock = parseCleanNumber(row[hTotalStockCol]);
    }

    // Kolom 21 (idx 20): Catatan
    const rawNotes = row[20] !== undefined && row[20] !== null ? String(row[20]).trim() : '';
    const notes =
      rawNotes && rawNotes !== '-' && rawNotes.toUpperCase() !== 'CATATAN' ? rawNotes : undefined;

    // Kolom 22 (idx 21): Terakhir Update
    const rawUpdated = row[21] !== undefined && row[21] !== null ? String(row[21]).trim() : '';
    const lastUpdated =
      rawUpdated && !rawUpdated.toUpperCase().includes('UPDATE')
        ? rawUpdated
        : new Date().toISOString();

    items.push({
      id,
      sku,
      name,
      category,
      unit,
      isiPerDus,
      currentStock,
      stockGudang,
      stockGudangUtama: stockGudang,
      stockPiranha,
      stockGudangPiranha: stockPiranha,
      stockToko,
      minStock,
      unitPrice: costPrice,
      costPrice,
      profitMarginPercent: profitMarginPercent || 25,
      priceEceran,
      priceGrosir,
      pricePartai,
      priceTiers: {
        eceran: priceEceran,
        grosir: priceGrosir,
        partai: pricePartai,
      },
      merk,
      brand: merk,
      location,
      notes,
      lastUpdated,
    });
  });

  return items;
}

/**
 * Fetches the stock list directly from the sheet named " STOCK LIST" (or "STOCK LIST")
 */
export async function fetchStockListFromSheet(
  accessToken: string,
  spreadsheetId: string
): Promise<{
  items: Item[];
  sheetTitle: string;
  count: number;
}> {
  // 1. Fetch metadata to find available sheet tabs
  const metaRes = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}?fields=sheets.properties.title`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!metaRes.ok) {
    const err = await metaRes.json().catch(() => ({}));
    throw new Error(
      err.error?.message ||
        'Gagal membaca spreadsheet. Pastikan Anda telah masuk ke Akun Google dan memiliki izin akses.'
    );
  }

  const metaData = await metaRes.json();
  const sheetTitles: string[] = (metaData.sheets || []).map(
    (s: any) => s.properties?.title || ''
  );

  // 2. Find target sheet matching " STOCK LIST"
  const targetSheet = findStockListSheetTitle(sheetTitles);

  if (!targetSheet) {
    throw new Error(
      `Sheet " STOCK LIST" belum ditemukan di spreadsheet ini. Sheet yang tersedia: ${
        sheetTitles.join(', ') || 'kosong'
      }.`
    );
  }

  // 3. Fetch data range from the found sheet
  const rangeUrl = `${SHEETS_API_BASE}/${spreadsheetId}/values/'${encodeURIComponent(
    targetSheet
  )}'!A1:Z5000`;
  const dataRes = await fetch(rangeUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!dataRes.ok) {
    const err = await dataRes.json().catch(() => ({}));
    throw new Error(
      err.error?.message || `Gagal mengambil data dari sheet "${targetSheet}".`
    );
  }

  const data = await dataRes.json();
  const rawRows: any[][] = data.values || [];

  if (rawRows.length <= 1) {
    return {
      items: [],
      sheetTitle: targetSheet,
      count: 0,
    };
  }

  const headerRow = rawRows[0].map((h) => String(h || '').trim());
  const dataRows = rawRows.slice(1);

  const items = parseRowsToItems(headerRow, dataRows);

  return {
    items,
    sheetTitle: targetSheet,
    count: items.length,
  };
}

/**
 * Ensures that the required sheet tabs exist in the target spreadsheet.
 * Uses " STOCK LIST" (or "STOCK LIST") as the primary master product sheet.
 */
export async function ensureSpreadsheetTabs(
  accessToken: string,
  spreadsheetId: string
): Promise<{
  sheetTitles: string[];
  stockSheetTitle: string;
  sheetMap: Record<string, number>;
}> {
  const metaRes = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}?fields=properties.title,sheets.properties`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!metaRes.ok) {
    const err = await metaRes.json().catch(() => ({}));
    throw new Error(
      err.error?.message ||
        'Gagal mengakses spreadsheet. Pastikan akun Google Anda memiliki akses edit pada spreadsheet ini.'
    );
  }

  const metaData = await metaRes.json();
  const sheets: Array<{ properties: { sheetId: number; title: string } }> = metaData.sheets || [];
  const existingSheetTitles = new Set(sheets.map((s) => s.properties.title));
  const sheetMap: Record<string, number> = {};
  sheets.forEach((s) => {
    sheetMap[s.properties.title] = s.properties.sheetId;
  });

  // Find if " STOCK LIST" or "STOCK LIST" exists
  const existingStockListTitle = sheets.find(
    (s) => s.properties.title.trim().toUpperCase() === 'STOCK LIST'
  )?.properties.title;

  const stockSheetTitle = existingStockListTitle || ' STOCK LIST';

  const REQUIRED_TABS = [
    stockSheetTitle,
    'MUTASI_TRANSAKSI',
    'DATA_PELANGGAN',
    'DATA_PEMASOK',
    'RINGKASAN_GUDANG',
  ];

  const batchRequests: any[] = [];

  // If no stock list sheet exists, rename first sheet if it's default Sheet1, otherwise create
  if (!existingStockListTitle && !existingSheetTitles.has(stockSheetTitle)) {
    if (
      sheets.length > 0 &&
      (sheets[0].properties.title === 'Sheet1' ||
        sheets[0].properties.title === 'Lembar1' ||
        sheets[0].properties.sheetId === 0)
    ) {
      batchRequests.push({
        updateSheetProperties: {
          properties: {
            sheetId: sheets[0].properties.sheetId,
            title: stockSheetTitle,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
          fields: 'title,gridProperties.frozenRowCount',
        },
      });
      existingSheetTitles.add(stockSheetTitle);
      sheetMap[stockSheetTitle] = sheets[0].properties.sheetId;
    } else {
      batchRequests.push({
        addSheet: {
          properties: {
            title: stockSheetTitle,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      });
      existingSheetTitles.add(stockSheetTitle);
    }
  }

  // Add other required sheets if missing
  for (const tab of REQUIRED_TABS) {
    if (!existingSheetTitles.has(tab)) {
      batchRequests.push({
        addSheet: {
          properties: {
            title: tab,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      });
      existingSheetTitles.add(tab);
    }
  }

  if (batchRequests.length > 0) {
    const updateRes = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: batchRequests,
      }),
    });

    if (!updateRes.ok) {
      const err = await updateRes.json().catch(() => ({}));
      console.warn('Sheet tab creation note:', err.error?.message);
    }
  }

  return {
    sheetTitles: Array.from(existingSheetTitles),
    stockSheetTitle,
    sheetMap,
  };
}

/**
 * Creates a brand new spreadsheet with " STOCK LIST"
 */
export async function createInventorySpreadsheet(
  accessToken: string,
  title: string,
  initialItems: Item[] = [],
  initialTransactions: Transaction[] = [],
  initialCustomers: Customer[] = [],
  initialSuppliers: Supplier[] = []
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const payload = {
    properties: {
      title: title || `GLOBAL MART - Inventory Gudang (${new Date().toLocaleDateString('id-ID')})`,
    },
    sheets: [
      {
        properties: {
          title: ' STOCK LIST',
          gridProperties: { frozenRowCount: 1 },
        },
      },
      {
        properties: {
          title: 'MUTASI_TRANSAKSI',
          gridProperties: { frozenRowCount: 1 },
        },
      },
      {
        properties: {
          title: 'DATA_PELANGGAN',
          gridProperties: { frozenRowCount: 1 },
        },
      },
      {
        properties: {
          title: 'DATA_PEMASOK',
          gridProperties: { frozenRowCount: 1 },
        },
      },
      {
        properties: {
          title: 'RINGKASAN_GUDANG',
          gridProperties: { frozenRowCount: 1 },
        },
      },
    ],
  };

  const createRes = await fetch(SHEETS_API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(err.error?.message || 'Gagal membuat Google Spreadsheet baru.');
  }

  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Write all data
  await syncFullDataToSheet(
    accessToken,
    spreadsheetId,
    initialItems,
    initialTransactions,
    initialCustomers,
    initialSuppliers
  );

  return { spreadsheetId, spreadsheetUrl };
}

/**
 * Appends a new single transaction row to MUTASI_TRANSAKSI
 */
export async function appendTransactionToSheet(
  accessToken: string,
  spreadsheetId: string,
  transaction: Transaction
): Promise<boolean> {
  const row = transactionToSheetRow(transaction);
  const res = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/MUTASI_TRANSAKSI!A:T:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [row],
      }),
    }
  );

  return res.ok;
}

/**
 * Full sync: writes all items to sheet " STOCK LIST" (and DATA_BARANG if exists),
 * and syncs MUTASI_TRANSAKSI, DATA_PELANGGAN, DATA_PEMASOK, and RINGKASAN_GUDANG.
 */
export async function syncFullDataToSheet(
  accessToken: string,
  spreadsheetId: string,
  items: Item[],
  transactions: Transaction[],
  customers: Customer[] = [],
  suppliers: Supplier[] = []
): Promise<SyncResult> {
  try {
    // 1. Ensure tabs exist and identify exact stock sheet title (e.g. " STOCK LIST")
    const { stockSheetTitle, sheetTitles } = await ensureSpreadsheetTabs(
      accessToken,
      spreadsheetId
    );

    // 2. Prepare tabular data
    const summary = calculateStockSummary(items, transactions);
    const itemRows = [ITEM_SHEET_HEADERS, ...items.map(itemToSheetRow)];
    const txRows = [TRANSACTION_SHEET_HEADERS, ...transactions.map(transactionToSheetRow)];
    const customerRows = [CUSTOMER_SHEET_HEADERS, ...customers.map(customerToSheetRow)];
    const supplierRows = [SUPPLIER_SHEET_HEADERS, ...suppliers.map(supplierToSheetRow)];
    const summaryRows = [
      SUMMARY_SHEET_HEADERS,
      ...summaryToSheetRows(summary, items.length, customers.length, suppliers.length),
    ];

    // 3. Clear existing ranges
    const clearSheets = [
      `'${stockSheetTitle}'!A1:Z`,
      'MUTASI_TRANSAKSI!A1:Z',
      'DATA_PELANGGAN!A1:Z',
      'DATA_PEMASOK!A1:Z',
      'RINGKASAN_GUDANG!A1:Z',
    ];

    if (sheetTitles.includes('DATA_BARANG') && stockSheetTitle !== 'DATA_BARANG') {
      clearSheets.push('DATA_BARANG!A1:Z');
    }

    await Promise.all(
      clearSheets.map((range) =>
        fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }).catch(() => {})
      )
    );

    // 4. Batch update
    const updateData: Array<{ range: string; values: any[][] }> = [
      {
        range: `'${stockSheetTitle}'!A1`,
        values: itemRows,
      },
      {
        range: 'MUTASI_TRANSAKSI!A1',
        values: txRows,
      },
      {
        range: 'DATA_PELANGGAN!A1',
        values: customerRows,
      },
      {
        range: 'DATA_PEMASOK!A1',
        values: supplierRows,
      },
      {
        range: 'RINGKASAN_GUDANG!A1',
        values: summaryRows,
      },
    ];

    // If DATA_BARANG also exists separately in sheet, sync to it as well
    if (sheetTitles.includes('DATA_BARANG') && stockSheetTitle !== 'DATA_BARANG') {
      updateData.push({
        range: 'DATA_BARANG!A1',
        values: itemRows,
      });
    }

    const updateRes = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: updateData,
      }),
    });

    if (!updateRes.ok) {
      const err = await updateRes.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Gagal menulis data ke Google Sheets.');
    }

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    return {
      success: true,
      message: `Semua data (${items.length} produk di sheet "${stockSheetTitle}", ${transactions.length} mutasi, ${customers.length} customer, ${suppliers.length} supplier) berhasil tersimpan ke Google Sheets!`,
      updatedAt: new Date().toLocaleTimeString('id-ID'),
      spreadsheetUrl,
    };
  } catch (error: any) {
    console.error('Error syncing to sheet:', error);
    return {
      success: false,
      message: error.message || 'Terjadi kesalahan saat menyinkronkan spreadsheet.',
    };
  }
}

/**
 * Validates connection and permissions to a Google Spreadsheet
 */
export async function testSpreadsheetConnection(
  accessToken: string,
  spreadsheetId: string
): Promise<{ valid: boolean; title?: string; error?: string }> {
  try {
    const res = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}?fields=properties.title,sheets.properties.title`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        valid: false,
        error:
          err.error?.message ||
          'ID Spreadsheet tidak ditemukan atau akun Google Anda tidak memiliki izin edit.',
      };
    }

    const data = await res.json();
    return {
      valid: true,
      title: data.properties?.title || 'Spreadsheet',
    };
  } catch (err: any) {
    return {
      valid: false,
      error: err.message || 'Koneksi ke Google Sheets gagal.',
    };
  }
}
