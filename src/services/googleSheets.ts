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
  DATABASE_CUSTOMER_HEADERS,
  DATABASE_SUPPLIER_HEADERS,
  HISTORY_PEMBELIAN_HEADERS,
  HISTORY_PENJUALAN_HEADERS,
  SALES_SHEET_HEADERS,
  itemToSheetRow,
  transactionToSheetRow,
  customerToSheetRow,
  supplierToSheetRow,
  customerToDatabaseCustomerRow,
  supplierToDatabaseSupplierRow,
  transactionToHistoryPembelianRow,
  transactionToHistoryPenjualanRow,
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
 * Parses raw text or numeric cell into a clean number.
 * Robustly preserves zeroes (0, thousands separators like 150,000 or 150.000, 1,500,000, etc.)
 * so digit 0s are never truncated or lost.
 */
export function parseCleanNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (val === null || val === undefined) return 0;

  let s = String(val).trim();
  if (s === '' || s === '-') return 0;

  // Remove currency prefix like Rp, Rp., IDR, $, spaces, %
  s = s.replace(/^(?:Rp\.?|IDR|\$)\s*/i, '').replace(/[\s%]/g, '');

  // Handle trailing Indonesian ",-" or ".-" (e.g. "150.000,-")
  s = s.replace(/[,.]-$/, '');

  // Check if both dot and comma exist:
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');

  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) {
      // Indonesian format: dots are thousands separators, comma is decimal (e.g. 1.500.000,50)
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: commas are thousands separators, dot is decimal (e.g. 1,500,000.50)
      s = s.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    // Only comma(s) exist
    const parts = s.split(',');
    if (parts.length > 2) {
      // Multiple commas: e.g. "1,500,000" -> thousands separator
      s = s.replace(/,/g, '');
    } else if (parts.length === 2) {
      const intPart = parts[0];
      const decPart = parts[1];
      // If integer part is "0" or "-0" or empty, e.g. "0,500", "0,5", ",25" -> ALWAYS A DECIMAL!
      if (intPart === '0' || intPart === '-0' || intPart === '') {
        s = `${intPart || '0'}.${decPart}`;
      } else if (decPart.length === 3 && Math.abs(Number(intPart)) >= 1) {
        // e.g. "150,000", "1,000" -> standard thousands separator in US notation
        s = s.replace(/,/g, '');
      } else {
        // e.g. "12,5", "10,50", "0,25" -> decimal comma in Indonesian notation
        s = `${intPart}.${decPart}`;
      }
    }
  } else if (lastDot !== -1) {
    // Only dot(s) exist
    const parts = s.split('.');
    if (parts.length > 2) {
      // Multiple dots: e.g. "1.500.000" -> thousands separator
      s = s.replace(/\./g, '');
    } else if (parts.length === 2) {
      const intPart = parts[0];
      const decPart = parts[1];
      // If integer part is "0" or "-0" or empty, e.g. "0.500", "0.25", ".75" -> ALWAYS A DECIMAL!
      if (intPart === '0' || intPart === '-0' || intPart === '') {
        s = `${intPart || '0'}.${decPart}`;
      } else if (decPart.length === 3 && Math.abs(Number(intPart)) >= 1) {
        // e.g. "150.000", "10.000" -> Indonesian thousands separator
        s = s.replace(/\./g, '');
      } else {
        // e.g. "12.5", "10.50", "0.25" -> standard decimal dot
      }
    }
  }

  const n = parseFloat(s);
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

    const sku = rawSku !== '' ? rawSku : `SKU-${String(idx + 1).padStart(3, '0')}`;
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

    // Only fallback if price columns do not exist in the sheet at all
    const hasPriceColsInSheet =
      row[12] !== undefined || row[13] !== undefined || row[14] !== undefined ||
      hEceranCol !== -1 || hGrosirCol !== -1 || hPartaiCol !== -1;
    if (!hasPriceColsInSheet && costPrice > 0) {
      const calculatedTiers = calculateTierPrices(costPrice, profitMarginPercent || 25);
      priceEceran = calculatedTiers.eceran;
      priceGrosir = calculatedTiers.grosir;
      pricePartai = calculatedTiers.partai;
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
    if (row[15] !== undefined && String(row[15]).trim() !== '') {
      const explicitTotal = parseCleanNumber(row[15]);
      if (currentStock === 0 || explicitTotal > 0) {
        currentStock = explicitTotal;
      }
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
 * Helper to fetch a sheet's headers and rows either using OAuth token or public gviz query
 */
export async function fetchSheetGridData(
  accessToken: string | null | undefined,
  spreadsheetId: string,
  candidateSheetNames: string[]
): Promise<{ headers: string[]; dataRows: any[][]; sheetTitle: string } | null> {
  // 1. Try OAuth if token exists
  if (accessToken) {
    for (const name of candidateSheetNames) {
      try {
        const rangeUrl = `${SHEETS_API_BASE}/${spreadsheetId}/values/'${encodeURIComponent(
          name
        )}'!A1:Z5000?valueRenderOption=FORMATTED_VALUE`;
        const res = await fetch(rangeUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          const values: any[][] = data.values || [];
          if (values.length > 0) {
            const headers = values[0].map((h) => String(h || '').trim());
            const dataRows = values.slice(1);
            return { headers, dataRows, sheetTitle: name };
          }
        }
      } catch (err) {
        console.warn(`OAuth fetch failed for sheet "${name}":`, err);
      }
    }
  }

  // 2. Fallback to public gviz API
  for (const name of candidateSheetNames) {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json${
        name ? `&sheet=${encodeURIComponent(name)}` : ''
      }`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const text = await res.text();
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end === -1) continue;
      const json = JSON.parse(text.slice(start, end + 1));
      if (!json.table || !json.table.rows) continue;

      let headers = (json.table.cols || []).map((c: any) => c.label || '');
      let dataRows = json.table.rows.map((r: any) =>
        (r.c || []).map((cell: any) => {
          if (!cell) return '';
          return cell.f !== undefined
            ? cell.f
            : cell.v !== null && cell.v !== undefined
            ? cell.v
            : '';
        })
      );

      // If headers are empty and first row contains header strings
      if (headers.every((h: string) => !h) && dataRows.length > 0) {
        headers = dataRows[0].map((c: any) => String(c || '').trim());
        dataRows = dataRows.slice(1);
      }

      return { headers, dataRows, sheetTitle: name };
    } catch (err) {
      console.warn(`Public gviz fetch failed for sheet "${name}":`, err);
    }
  }

  return null;
}

/**
 * Parses rows from sheet "DATABASE CUSTOMER" into Customer[]
 * Headers in sheet:
 * ["Kode & Nama Customer", "Kategori Tier", "Pembayaran & Termin", "Sales Penanggung Jawab", "Kontak & WhatsApp", "Kota / Wilayah", "Alamat Lengkap"]
 */
export function parseRowsToCustomers(headers: string[], rows: any[][]): Customer[] {
  const findCol = (regex: RegExp) =>
    headers.findIndex((h) => regex.test(String(h || '').trim().toLowerCase()));

  const hCombinedCol = findCol(/kode.*&.*nama|nama.*&.*kode/i);
  const hCodeCol = findCol(/^kode\b|kode.*customer|kode.*pelanggan|^id.*cust/i);
  const hNameCol = findCol(/^nama\b|nama.*customer|nama.*pelanggan|nama.*toko/i);
  const hTierCol = findCol(/kategori|tier|level/i);
  const hPayCol = findCol(/pembayaran|termin|payment|metode/i);
  const hSalesCol = findCol(/sales|penanggung.*jawab|pic.*sales/i);
  const hPhoneCol = findCol(/kontak|wa|whatsapp|telepon|hp|phone/i);
  const hEmailCol = findCol(/email|surel/i);
  const hCityCol = findCol(/kota|wilayah|daerah/i);
  const hAddressCol = findCol(/alamat|address/i);
  const hNotesCol = findCol(/catatan|keterangan|notes/i);

  const customers: Customer[] = [];

  rows.forEach((row, idx) => {
    if (!row || row.length === 0) return;

    let code = '';
    let name = '';

    if (hCombinedCol !== -1 && row[hCombinedCol]) {
      const combined = String(row[hCombinedCol]).trim();
      if (!combined || combined.toUpperCase().includes('KODE & NAMA')) return;
      const match = combined.match(/^(?:\[([^\]]+)\]|([A-Za-z0-9_-]+)\s*[-:/|])\s*(.*)$/);
      if (match) {
        code = match[1] || match[2] || '';
        name = match[3] || combined;
      } else {
        name = combined;
        code = `CST-${String(idx + 1).padStart(3, '0')}`;
      }
    } else if (hCodeCol !== -1 || hNameCol !== -1) {
      code = hCodeCol !== -1 && row[hCodeCol] ? String(row[hCodeCol]).trim() : '';
      name = hNameCol !== -1 && row[hNameCol] ? String(row[hNameCol]).trim() : '';
    } else if (row[0] !== undefined && row[0] !== null && String(row[0]).trim() !== '') {
      const raw0 = String(row[0]).trim();
      if (raw0.toUpperCase().includes('KODE') && raw0.toUpperCase().includes('CUSTOMER')) return;
      const match = raw0.match(/^(?:\[([^\]]+)\]|([A-Za-z0-9_-]+)\s*[-:/|])\s*(.*)$/);
      if (match) {
        code = match[1] || match[2] || '';
        name = match[3] || raw0;
      } else {
        name = raw0;
        code = `CST-${String(idx + 1).padStart(3, '0')}`;
      }
    }

    if (!name && !code) return;
    if (name.toUpperCase().includes('KODE & NAMA') || name.toUpperCase() === 'NAMA PELANGGAN/TOKO') return;
    if (!code) code = `CST-${String(idx + 1).padStart(3, '0')}`;
    if (!name) name = code;

    // Type / Tier
    const rawTier =
      hTierCol !== -1 && row[hTierCol]
        ? String(row[hTierCol]).trim()
        : row[1] !== undefined
        ? String(row[1]).trim()
        : 'Grosir';
    let type: Customer['type'] = 'Grosir';
    if (/eceran/i.test(rawTier)) type = 'Eceran';
    else if (/partai/i.test(rawTier)) type = 'Partai';

    // Payment & Termin
    const rawPay =
      hPayCol !== -1 && row[hPayCol]
        ? String(row[hPayCol]).trim()
        : row[2] !== undefined
        ? String(row[2]).trim()
        : 'CASH';
    const isKredit = /kredit|tempo|credit/i.test(rawPay);
    const paymentMethod: Customer['paymentMethod'] = isKredit ? 'KREDIT' : 'CASH';
    let creditTerm: Customer['creditTerm'] = undefined;
    if (isKredit) {
      if (/7\s*hari/i.test(rawPay)) creditTerm = '7 Hari';
      else if (/30\s*hari/i.test(rawPay)) creditTerm = '30 Hari';
      else creditTerm = '14 Hari';
    }

    // Sales Penanggung Jawab
    const salesPerson =
      hSalesCol !== -1 && row[hSalesCol]
        ? String(row[hSalesCol]).trim()
        : row[3] !== undefined && row[3] !== null
        ? String(row[3]).trim()
        : undefined;

    // Phone / WhatsApp
    const phone =
      hPhoneCol !== -1 && row[hPhoneCol]
        ? String(row[hPhoneCol]).trim()
        : row[4] !== undefined && row[4] !== null
        ? String(row[4]).trim()
        : '-';

    // City / Region
    const city =
      hCityCol !== -1 && row[hCityCol]
        ? String(row[hCityCol]).trim()
        : row[5] !== undefined && row[5] !== null
        ? String(row[5]).trim()
        : undefined;

    // Address
    const address =
      hAddressCol !== -1 && row[hAddressCol]
        ? String(row[hAddressCol]).trim()
        : row[6] !== undefined && row[6] !== null
        ? String(row[6]).trim()
        : '-';

    const email = hEmailCol !== -1 && row[hEmailCol] ? String(row[hEmailCol]).trim() : undefined;
    const notes = hNotesCol !== -1 && row[hNotesCol] ? String(row[hNotesCol]).trim() : undefined;

    const id = `cst-${code.toLowerCase().replace(/[^a-z0-9_-]/g, '-') || Date.now()}-${idx + 1}`;

    customers.push({
      id,
      code,
      name,
      phone,
      email: email && email !== '-' ? email : undefined,
      address,
      city: city && city !== '-' ? city : undefined,
      type,
      paymentMethod,
      creditTerm,
      salesPerson: salesPerson && salesPerson !== '-' ? salesPerson : undefined,
      notes: notes && notes !== '-' ? notes : undefined,
      createdAt: new Date().toISOString().slice(0, 10),
      lastUpdated: new Date().toISOString(),
    });
  });

  return customers;
}

/**
 * Parses rows from sheet "DATABASE SUPPLIER" into Supplier[]
 * Headers in sheet:
 * ["Kode", "Nama Supplier / Vendor", "Kontak & PIC", "Wilayah & Alamat", "Catatan Khusus", "Aksi"]
 */
export function parseRowsToSuppliers(headers: string[], rows: any[][]): Supplier[] {
  const findCol = (regex: RegExp) =>
    headers.findIndex((h) => regex.test(String(h || '').trim().toLowerCase()));

  const hCodeCol = findCol(/^kode\b|kode.*supp|id.*supp/i);
  const hNameCol = findCol(/^nama\b|nama.*supp|nama.*vendor|nama.*distributor/i);
  const hContactCol = findCol(/kontak.*pic|pic.*kontak|pic|telepon|hp|wa|whatsapp/i);
  const hAddrCol = findCol(/wilayah.*alamat|kota.*alamat|alamat/i);
  const hNotesCol = findCol(/catatan|keterangan|notes/i);

  const suppliers: Supplier[] = [];

  rows.forEach((row, idx) => {
    if (!row || row.length === 0) return;

    let code =
      hCodeCol !== -1 && row[hCodeCol]
        ? String(row[hCodeCol]).trim()
        : row[0] !== undefined && row[0] !== null
        ? String(row[0]).trim()
        : '';
    let name =
      hNameCol !== -1 && row[hNameCol]
        ? String(row[hNameCol]).trim()
        : row[1] !== undefined && row[1] !== null
        ? String(row[1]).trim()
        : '';

    if (!code && !name) return;
    if (code.toUpperCase() === 'KODE' && name.toUpperCase().includes('NAMA')) return;
    if (!code) code = `SUP-${String(idx + 1).padStart(3, '0')}`;
    if (!name) name = code;

    // Kontak & PIC
    const rawContact =
      hContactCol !== -1 && row[hContactCol]
        ? String(row[hContactCol]).trim()
        : row[2] !== undefined && row[2] !== null
        ? String(row[2]).trim()
        : '';
    let phone = rawContact || '-';
    let contactPerson: string | undefined = undefined;
    const picMatch = rawContact.match(/^(.*?)\s*[\(\[](.*?)[\)\]]$/);
    if (picMatch) {
      phone = picMatch[1].trim();
      contactPerson = picMatch[2].trim();
    }

    // Wilayah & Alamat
    const rawAddr =
      hAddrCol !== -1 && row[hAddrCol]
        ? String(row[hAddrCol]).trim()
        : row[3] !== undefined && row[3] !== null
        ? String(row[3]).trim()
        : '';
    let city: string | undefined = undefined;
    let address = rawAddr || '-';
    if (rawAddr.includes(' - ')) {
      const parts = rawAddr.split(' - ');
      city = parts[0].trim();
      address = parts.slice(1).join(' - ').trim();
    }

    // Catatan Khusus
    const notes =
      hNotesCol !== -1 && row[hNotesCol]
        ? String(row[hNotesCol]).trim()
        : row[4] !== undefined && row[4] !== null
        ? String(row[4]).trim()
        : undefined;

    const id = `sup-${code.toLowerCase().replace(/[^a-z0-9_-]/g, '-') || Date.now()}-${idx + 1}`;

    suppliers.push({
      id,
      code,
      name,
      phone,
      address,
      city: city && city !== '-' ? city : undefined,
      contactPerson: contactPerson && contactPerson !== '-' ? contactPerson : undefined,
      notes: notes && notes !== '-' ? notes : undefined,
      createdAt: new Date().toISOString().slice(0, 10),
      lastUpdated: new Date().toISOString(),
    });
  });

  return suppliers;
}

/**
 * Parses rows from sheet "HISTORY PEMBELIAN" (Barang Masuk) into Transaction[]
 * Headers:
 * ["ID Masuk", "Waktu Penerimaan", "Nama Barang & SKU", "🏢 Lokasi Gudang Masuk", "Kuantitas Masuk", "Harga Modal Satuan", "Total Nilai Pembelian", "Pemasok / Supplier", "No. PO / Surat Jalan", "Petugas Penerima", "Aksi"]
 */
export function parseRowsToPembelian(headers: string[], rows: any[][]): Transaction[] {
  const txs: Transaction[] = [];

  rows.forEach((row, idx) => {
    if (!row || row.length === 0) return;
    const rawId = row[0] !== undefined ? String(row[0]).trim() : '';
    if (!rawId || rawId.toUpperCase().includes('ID MASUK') || rawId.toUpperCase().includes('ID')) return;

    const rawWaktu = row[1] !== undefined ? String(row[1]).trim() : '';
    let date = new Date().toISOString().slice(0, 10);
    let time = '10:00';
    if (rawWaktu) {
      const parts = rawWaktu.split(' ');
      if (parts[0]) date = parts[0];
      if (parts[1]) time = parts[1];
    }

    const rawNamaSku = row[2] !== undefined ? String(row[2]).trim() : '';
    let sku = '';
    let itemName = rawNamaSku;
    const skuMatch = rawNamaSku.match(/^(.*?)\s*[\(\[]([A-Za-z0-9_-]+)[\)\]]$/);
    if (skuMatch) {
      itemName = skuMatch[1].trim();
      sku = skuMatch[2].trim();
    }

    const rawLokasi = row[3] !== undefined ? String(row[3]).trim() : 'Gudang Utama';
    const targetWarehouse =
      rawLokasi.includes('Piranha') ? 'Gudang Piranha' :
      rawLokasi.includes('Toko') ? 'Toko' : 'Gudang Utama';

    const quantity = parseCleanNumber(row[4]) || 1;
    const unitPrice = parseCleanNumber(row[5]) || 0;
    const totalPrice = parseCleanNumber(row[6]) || (quantity * unitPrice);
    const supplier = row[7] !== undefined ? String(row[7]).trim() : '-';
    const refDoc = row[8] !== undefined ? String(row[8]).trim() : '-';
    const operator = row[9] !== undefined ? String(row[9]).trim() : 'Petugas Penerima';
    const notes = row[10] !== undefined ? String(row[10]).trim() : '';

    txs.push({
      id: rawId || `TX-IN-${Date.now()}-${idx + 1}`,
      date,
      time,
      type: 'IN',
      targetWarehouse,
      itemId: `item-${sku || Date.now()}`,
      sku: sku || 'SKU-001',
      itemName: itemName || 'Barang Masuk',
      category: 'Umum',
      quantity,
      unit: 'pcs',
      unitPrice,
      totalPrice,
      recipientOrSupplier: supplier !== '-' ? supplier : 'Supplier',
      referenceDoc: refDoc !== '-' ? refDoc : undefined,
      operator: operator !== '-' ? operator : 'Admin',
      notes: notes && notes !== '-' ? notes : undefined,
      createdAt: `${date}T${time}:00.000Z`,
    });
  });

  return txs;
}

/**
 * Parses rows from sheet "HISTORY PENJUALAN" (Barang Keluar) into Transaction[]
 * Headers:
 * ["ID Penjualan", "Waktu Penjualan", "Nama Barang & SKU", "🏷️ Kategori Harga", "Kuantitas Terjual", "Harga Satuan Terjual", "Total Penjualan", "Pelanggan / Customer", "Sales Penanggung Jawab", "Metode Pembayaran", "No. DO / Ref", "Aksi"]
 */
export function parseRowsToPenjualan(headers: string[], rows: any[][]): Transaction[] {
  const txs: Transaction[] = [];

  rows.forEach((row, idx) => {
    if (!row || row.length === 0) return;
    const rawId = row[0] !== undefined ? String(row[0]).trim() : '';
    if (!rawId || rawId.toUpperCase().includes('ID PENJUALAN') || rawId.toUpperCase().includes('ID')) return;

    const rawWaktu = row[1] !== undefined ? String(row[1]).trim() : '';
    let date = new Date().toISOString().slice(0, 10);
    let time = '11:00';
    if (rawWaktu) {
      const parts = rawWaktu.split(' ');
      if (parts[0]) date = parts[0];
      if (parts[1]) time = parts[1];
    }

    const rawNamaSku = row[2] !== undefined ? String(row[2]).trim() : '';
    let sku = '';
    let itemName = rawNamaSku;
    const skuMatch = rawNamaSku.match(/^(.*?)\s*[\(\[]([A-Za-z0-9_-]+)[\)\]]$/);
    if (skuMatch) {
      itemName = skuMatch[1].trim();
      sku = skuMatch[2].trim();
    }

    const rawTier = row[3] !== undefined ? String(row[3]).trim().toLowerCase() : 'eceran';
    let priceTierUsed: 'eceran' | 'grosir' | 'partai' | 'modal' | 'custom' = 'eceran';
    if (rawTier.includes('grosir')) priceTierUsed = 'grosir';
    else if (rawTier.includes('partai')) priceTierUsed = 'partai';
    else if (rawTier.includes('modal') || rawTier.includes('hpp')) priceTierUsed = 'modal';

    const quantity = parseCleanNumber(row[4]) || 1;
    const unitPrice = parseCleanNumber(row[5]) || 0;
    const totalPrice = parseCleanNumber(row[6]) || (quantity * unitPrice);
    const customer = row[7] !== undefined ? String(row[7]).trim() : '-';
    const salesPerson = row[8] !== undefined ? String(row[8]).trim() : '-';

    const rawPay = row[9] !== undefined ? String(row[9]).trim() : 'CASH';
    const isKredit = /kredit|credit|tempo/i.test(rawPay);
    const paymentMethod: 'CASH' | 'KREDIT' = isKredit ? 'KREDIT' : 'CASH';
    let creditTerm: '7 Hari' | '14 Hari' | '30 Hari' | undefined = undefined;
    if (isKredit) {
      if (/7\s*hari/i.test(rawPay)) creditTerm = '7 Hari';
      else if (/30\s*hari/i.test(rawPay)) creditTerm = '30 Hari';
      else creditTerm = '14 Hari';
    }

    const refDoc = row[10] !== undefined ? String(row[10]).trim() : '-';
    const notes = row[11] !== undefined ? String(row[11]).trim() : '';

    txs.push({
      id: rawId || `TX-OUT-${Date.now()}-${idx + 1}`,
      date,
      time,
      type: 'OUT',
      itemId: `item-${sku || Date.now()}`,
      sku: sku || 'SKU-001',
      itemName: itemName || 'Barang Keluar',
      category: 'Umum',
      quantity,
      unit: 'pcs',
      unitPrice,
      totalPrice,
      priceTierUsed,
      recipientOrSupplier: customer !== '-' ? customer : 'Customer',
      salesPerson: salesPerson !== '-' ? salesPerson : undefined,
      paymentMethod,
      creditTerm,
      referenceDoc: refDoc !== '-' ? refDoc : undefined,
      operator: 'Petugas Toko',
      notes: notes && notes !== '-' ? notes : undefined,
      createdAt: `${date}T${time}:00.000Z`,
    });
  });

  return txs;
}

/**
 * Parses rows from sheet "SALES" into string[] (Nama Sales)
 */
export function parseRowsToSales(rows: any[][]): string[] {
  const result: string[] = [];
  const skipWords = new Set(['NAMA SALES', 'SALES', 'NAMA', 'NAMA LENGKAP', 'PIC SALES']);
  for (const row of rows) {
    if (!row || row.length === 0) continue;
    const val = String(row[0] || '').trim();
    if (!val || skipWords.has(val.toUpperCase())) continue;
    // Format to title case
    const clean = val.toLowerCase().replace(/(?:^|\s|-)\S/g, (c) => c.toUpperCase());
    if (!result.includes(clean)) {
      result.push(clean);
    }
  }
  return result;
}

/**
 * Fetches Customer database directly from sheet "DATABASE CUSTOMER"
 */
export async function fetchCustomersFromSheet(
  accessToken: string | null | undefined,
  spreadsheetId: string
): Promise<{ customers: Customer[]; sheetTitle: string; count: number }> {
  const candidateNames = ['DATABASE CUSTOMER', 'DATABASE_CUSTOMER', 'DATA_PELANGGAN', 'CUSTOMER'];
  const grid = await fetchSheetGridData(accessToken, spreadsheetId, candidateNames);

  if (grid && grid.dataRows.length > 0) {
    const customers = parseRowsToCustomers(grid.headers, grid.dataRows);
    return {
      customers,
      sheetTitle: grid.sheetTitle,
      count: customers.length,
    };
  }

  return { customers: [], sheetTitle: 'DATABASE CUSTOMER', count: 0 };
}

/**
 * Fetches Supplier database directly from sheet "DATABASE SUPPLIER"
 */
export async function fetchSuppliersFromSheet(
  accessToken: string | null | undefined,
  spreadsheetId: string
): Promise<{ suppliers: Supplier[]; sheetTitle: string; count: number }> {
  const candidateNames = ['DATABASE SUPPLIER', 'DATABASE_SUPPLIER', 'DATA_PEMASOK', 'SUPPLIER'];
  const grid = await fetchSheetGridData(accessToken, spreadsheetId, candidateNames);

  if (grid && grid.dataRows.length > 0) {
    const suppliers = parseRowsToSuppliers(grid.headers, grid.dataRows);
    return {
      suppliers,
      sheetTitle: grid.sheetTitle,
      count: suppliers.length,
    };
  }

  return { suppliers: [], sheetTitle: 'DATABASE SUPPLIER', count: 0 };
}

/**
 * Fetches Transactions from sheet "HISTORY PEMBELIAN" and "HISTORY PENJUALAN"
 */
export async function fetchTransactionsFromSheets(
  accessToken: string | null | undefined,
  spreadsheetId: string
): Promise<{ transactions: Transaction[]; count: number }> {
  const allTxs: Transaction[] = [];

  // 1. Fetch History Pembelian
  const gridPembelian = await fetchSheetGridData(accessToken, spreadsheetId, [
    'HISTORY PEMBELIAN',
    'HISTORY_PEMBELIAN',
    'PEMBELIAN',
  ]);
  if (gridPembelian && gridPembelian.dataRows.length > 0) {
    const txsIn = parseRowsToPembelian(gridPembelian.headers, gridPembelian.dataRows);
    allTxs.push(...txsIn);
  }

  // 2. Fetch History Penjualan
  const gridPenjualan = await fetchSheetGridData(accessToken, spreadsheetId, [
    'HISTORY PENJUALAN',
    'HISTORY_PENJUALAN',
    'PENJUALAN',
  ]);
  if (gridPenjualan && gridPenjualan.dataRows.length > 0) {
    const txsOut = parseRowsToPenjualan(gridPenjualan.headers, gridPenjualan.dataRows);
    allTxs.push(...txsOut);
  }

  // Fallback to MUTASI_TRANSAKSI if both history sheets are empty
  if (allTxs.length === 0) {
    const gridMutasi = await fetchSheetGridData(accessToken, spreadsheetId, [
      'MUTASI_TRANSAKSI',
      'TRANSAKSI',
    ]);
    if (gridMutasi && gridMutasi.dataRows.length > 0) {
      gridMutasi.dataRows.forEach((r, idx) => {
        const id = String(r[0] || '').trim();
        if (!id || id.toUpperCase().includes('ID')) return;
        const date = String(r[1] || '').trim();
        const time = String(r[2] || '').trim();
        const typeStr = String(r[3] || '').trim().toUpperCase();
        const isOut = typeStr.includes('KELUAR') || typeStr === 'OUT';
        const sku = String(r[4] || '').trim();
        const itemName = String(r[5] || '').trim();
        const category = String(r[6] || 'Umum').trim();
        const quantity = parseCleanNumber(r[7]) || 1;
        const unit = String(r[8] || 'pcs').trim();
        const unitPrice = parseCleanNumber(r[9]) || 0;
        const totalPrice = parseCleanNumber(r[10]) || (quantity * unitPrice);
        const partner = String(r[11] || '-').trim();
        const refDoc = String(r[12] || '-').trim();
        const operator = String(r[13] || '-').trim();
        const notes = String(r[14] || '').trim();

        allTxs.push({
          id,
          date: date || new Date().toISOString().slice(0, 10),
          time: time || '10:00',
          type: isOut ? 'OUT' : 'IN',
          itemId: `item-${sku || Date.now()}`,
          sku: sku || 'SKU-001',
          itemName: itemName || 'Barang',
          category,
          quantity,
          unit,
          unitPrice,
          totalPrice,
          recipientOrSupplier: partner,
          referenceDoc: refDoc !== '-' ? refDoc : undefined,
          operator: operator !== '-' ? operator : 'Admin',
          notes: notes && notes !== '-' ? notes : undefined,
          createdAt: `${date}T${time}:00.000Z`,
        });
      });
    }
  }

  // Sort descending
  allTxs.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));

  return { transactions: allTxs, count: allTxs.length };
}

/**
 * Fetches list of Sales representatives directly from sheet "SALES"
 */
export async function fetchSalesFromSheet(
  accessToken: string | null | undefined,
  spreadsheetId: string
): Promise<string[]> {
  const grid = await fetchSheetGridData(accessToken, spreadsheetId, ['SALES', 'Sales', 'DATA_SALES']);
  if (grid) {
    const allRows: any[][] = [];
    if (grid.headers && grid.headers.length > 0 && grid.headers[0]) {
      allRows.push([grid.headers[0]]);
    }
    allRows.push(...grid.dataRows);
    const parsed = parseRowsToSales(allRows);
    if (parsed.length > 0) return parsed;
  }
  return [];
}

/**
 * Fetches the stock list directly from the sheet named " STOCK LIST" (or "STOCK LIST")
 */
/**
 * Fetches stock list from Google Sheets publicly via Google Visualization API
 * Supports public spreadsheets without requiring user OAuth login.
 */
export async function fetchStockListPublic(
  spreadsheetId: string
): Promise<{ items: Item[]; sheetTitle: string; count: number }> {
  const candidateNames = ['STOCK LIST', ' STOCK LIST', ''];
  let lastError: any = null;

  for (const sheetName of candidateNames) {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json${
        sheetName ? `&sheet=${encodeURIComponent(sheetName)}` : ''
      }`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const text = await res.text();
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end === -1) continue;
      const json = JSON.parse(text.slice(start, end + 1));
      if (!json.table || !json.table.rows) continue;

      const headers = json.table.cols.map((c: any) => c.label || '');
      const dataRows = json.table.rows.map((r: any) =>
        r.c.map((cell: any) => {
          if (!cell) return '';
          return cell.f !== undefined
            ? cell.f
            : cell.v !== null && cell.v !== undefined
            ? cell.v
            : '';
        })
      );

      const items = parseRowsToItems(headers, dataRows);
      if (items.length > 0) {
        return {
          items,
          sheetTitle: sheetName || 'STOCK LIST',
          count: items.length,
        };
      }
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error('Gagal mengambil data dari Google Sheets.');
}

/**
 * Fetches data from " STOCK LIST" (or "STOCK LIST")
 * Supports OAuth token and automatically falls back to public fetch if token is unavailable or fails.
 */
export async function fetchStockListFromSheet(
  accessToken: string | null | undefined,
  spreadsheetId: string
): Promise<{
  items: Item[];
  sheetTitle: string;
  count: number;
}> {
  if (accessToken) {
    try {
      // 1. Fetch metadata to find available sheet tabs
      const metaRes = await fetch(
        `${SHEETS_API_BASE}/${spreadsheetId}?fields=sheets.properties.title`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (metaRes.ok) {
        const metaData = await metaRes.json();
        const sheetTitles: string[] = (metaData.sheets || []).map(
          (s: any) => s.properties?.title || ''
        );

        // 2. Find target sheet matching " STOCK LIST"
        const targetSheet = findStockListSheetTitle(sheetTitles);

        if (targetSheet) {
          // 3. Fetch data range from the found sheet (using FORMATTED_VALUE to preserve leading zeroes and formats)
          const rangeUrl = `${SHEETS_API_BASE}/${spreadsheetId}/values/'${encodeURIComponent(
            targetSheet
          )}'!A1:Z5000?valueRenderOption=FORMATTED_VALUE`;
          const dataRes = await fetch(rangeUrl, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (dataRes.ok) {
            const data = await dataRes.json();
            const rawRows: any[][] = data.values || [];

            if (rawRows.length > 1) {
              const headerRow = rawRows[0].map((h) => String(h || '').trim());
              const dataRows = rawRows.slice(1);
              const items = parseRowsToItems(headerRow, dataRows);

              return {
                items,
                sheetTitle: targetSheet,
                count: items.length,
              };
            }
          }
        }
      }
    } catch (err) {
      console.warn('OAuth Sheets API fetch failed, trying public fallback:', err);
    }
  }

  // Fallback to public gviz fetch
  return fetchStockListPublic(spreadsheetId);
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
    'DATABASE CUSTOMER',
    'DATABASE SUPPLIER',
    'HISTORY PEMBELIAN',
    'HISTORY PENJUALAN',
    'SALES',
    'MUTASI_TRANSAKSI',
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
 * Creates a brand new spreadsheet with user-requested tabs
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
          title: 'DATABASE CUSTOMER',
          gridProperties: { frozenRowCount: 1 },
        },
      },
      {
        properties: {
          title: 'DATABASE SUPPLIER',
          gridProperties: { frozenRowCount: 1 },
        },
      },
      {
        properties: {
          title: 'HISTORY PEMBELIAN',
          gridProperties: { frozenRowCount: 1 },
        },
      },
      {
        properties: {
          title: 'HISTORY PENJUALAN',
          gridProperties: { frozenRowCount: 1 },
        },
      },
      {
        properties: {
          title: 'SALES',
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
 * Appends a new single transaction row to HISTORY PEMBELIAN or HISTORY PENJUALAN
 * and syncs to MUTASI_TRANSAKSI as unified log.
 */
export async function appendTransactionToSheet(
  accessToken: string,
  spreadsheetId: string,
  transaction: Transaction
): Promise<boolean> {
  const isIncoming = transaction.type === 'IN';
  const targetSheet = isIncoming ? 'HISTORY PEMBELIAN' : 'HISTORY PENJUALAN';
  const targetRow = isIncoming
    ? transactionToHistoryPembelianRow(transaction)
    : transactionToHistoryPenjualanRow(transaction);

  let success = false;

  // 1. Append to dedicated History sheet
  try {
    const res = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/'${encodeURIComponent(
        targetSheet
      )}'!A:L:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [targetRow],
        }),
      }
    );
    if (res.ok) success = true;
  } catch (err) {
    console.warn(`Failed to append to ${targetSheet}:`, err);
  }

  // 2. Also append to MUTASI_TRANSAKSI as unified history
  try {
    const unifiedRow = transactionToSheetRow(transaction);
    await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/MUTASI_TRANSAKSI!A:T:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [unifiedRow],
        }),
      }
    );
  } catch (err) {
    console.warn('Failed to append to MUTASI_TRANSAKSI:', err);
  }

  return success;
}

/**
 * Appends a new single customer row to sheet "DATABASE CUSTOMER"
 */
export async function appendCustomerToSheet(
  accessToken: string,
  spreadsheetId: string,
  customer: Customer
): Promise<boolean> {
  const targetRow = customerToDatabaseCustomerRow(customer);
  try {
    const res = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/'${encodeURIComponent(
        'DATABASE CUSTOMER'
      )}'!A:G:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [targetRow],
        }),
      }
    );
    return res.ok;
  } catch (err) {
    console.warn('Failed to append customer to DATABASE CUSTOMER:', err);
    return false;
  }
}

/**
 * Appends a new single supplier row to sheet "DATABASE SUPPLIER"
 */
export async function appendSupplierToSheet(
  accessToken: string,
  spreadsheetId: string,
  supplier: Supplier
): Promise<boolean> {
  const targetRow = supplierToDatabaseSupplierRow(supplier);
  try {
    const res = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/'${encodeURIComponent(
        'DATABASE SUPPLIER'
      )}'!A:F:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [targetRow],
        }),
      }
    );
    return res.ok;
  } catch (err) {
    console.warn('Failed to append supplier to DATABASE SUPPLIER:', err);
    return false;
  }
}

/**
 * Appends a new item row to sheet " STOCK LIST" (or "STOCK LIST")
 */
export async function appendItemToSheet(
  accessToken: string,
  spreadsheetId: string,
  item: Item,
  stockSheetTitle: string = ' STOCK LIST'
): Promise<boolean> {
  const targetRow = itemToSheetRow(item);
  try {
    const res = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/'${encodeURIComponent(
        stockSheetTitle
      )}'!A:T:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [targetRow],
        }),
      }
    );
    return res.ok;
  } catch (err) {
    console.warn(`Failed to append item to ${stockSheetTitle}:`, err);
    return false;
  }
}

/**
 * Appends a new sales person name to sheet "SALES"
 */
export async function appendSalesToSheet(
  accessToken: string,
  spreadsheetId: string,
  salesName: string
): Promise<boolean> {
  if (!salesName || !salesName.trim()) return false;
  try {
    const res = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/'${encodeURIComponent(
        'SALES'
      )}'!A:A:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [[salesName.trim()]],
        }),
      }
    );
    return res.ok;
  } catch (err) {
    console.warn('Failed to append sales person to SALES:', err);
    return false;
  }
}

/**
 * Full sync: writes all items to sheet " STOCK LIST",
 * customers to "DATABASE CUSTOMER", suppliers to "DATABASE SUPPLIER",
 * purchases to "HISTORY PEMBELIAN", sales to "HISTORY PENJUALAN",
 * sales persons to "SALES", unified transactions to "MUTASI_TRANSAKSI",
 * and KPI to "RINGKASAN_GUDANG".
 */
export async function syncFullDataToSheet(
  accessToken: string,
  spreadsheetId: string,
  items: Item[],
  transactions: Transaction[],
  customers: Customer[] = [],
  suppliers: Supplier[] = [],
  salesPersons: string[] = []
): Promise<SyncResult> {
  try {
    // 1. Ensure tabs exist and identify exact stock sheet title (e.g. " STOCK LIST")
    const { stockSheetTitle, sheetTitles } = await ensureSpreadsheetTabs(
      accessToken,
      spreadsheetId
    );

    // 2. Prepare tabular data
    const inTxs = transactions.filter((t) => t.type === 'IN');
    const outTxs = transactions.filter((t) => t.type === 'OUT');

    const summary = calculateStockSummary(items, transactions);
    const itemRows = [ITEM_SHEET_HEADERS, ...items.map(itemToSheetRow)];
    const customerDbRows = [DATABASE_CUSTOMER_HEADERS, ...customers.map(customerToDatabaseCustomerRow)];
    const supplierDbRows = [DATABASE_SUPPLIER_HEADERS, ...suppliers.map(supplierToDatabaseSupplierRow)];
    const pembelianRows = [HISTORY_PEMBELIAN_HEADERS, ...inTxs.map(transactionToHistoryPembelianRow)];
    const penjualanRows = [HISTORY_PENJUALAN_HEADERS, ...outTxs.map(transactionToHistoryPenjualanRow)];
    const txRows = [TRANSACTION_SHEET_HEADERS, ...transactions.map(transactionToSheetRow)];
    const legacyCustomerRows = [CUSTOMER_SHEET_HEADERS, ...customers.map(customerToSheetRow)];
    const legacySupplierRows = [SUPPLIER_SHEET_HEADERS, ...suppliers.map(supplierToSheetRow)];
    const salesRows = [
      SALES_SHEET_HEADERS,
      ...salesPersons.map((name) => [name]),
    ];
    const summaryRows = [
      SUMMARY_SHEET_HEADERS,
      ...summaryToSheetRows(summary, items.length, customers.length, suppliers.length),
    ];

    // 3. Clear existing ranges
    const clearSheets = [
      `'${stockSheetTitle}'!A1:Z`,
      `'DATABASE CUSTOMER'!A1:Z`,
      `'DATABASE SUPPLIER'!A1:Z`,
      `'HISTORY PEMBELIAN'!A1:Z`,
      `'HISTORY PENJUALAN'!A1:Z`,
      `'SALES'!A1:Z`,
      'MUTASI_TRANSAKSI!A1:Z',
      'RINGKASAN_GUDANG!A1:Z',
    ];

    if (sheetTitles.includes('DATA_PELANGGAN')) clearSheets.push('DATA_PELANGGAN!A1:Z');
    if (sheetTitles.includes('DATA_PEMASOK')) clearSheets.push('DATA_PEMASOK!A1:Z');
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
        range: `'DATABASE CUSTOMER'!A1`,
        values: customerDbRows,
      },
      {
        range: `'DATABASE SUPPLIER'!A1`,
        values: supplierDbRows,
      },
      {
        range: `'HISTORY PEMBELIAN'!A1`,
        values: pembelianRows,
      },
      {
        range: `'HISTORY PENJUALAN'!A1`,
        values: penjualanRows,
      },
      {
        range: `'SALES'!A1`,
        values: salesRows,
      },
      {
        range: 'MUTASI_TRANSAKSI!A1',
        values: txRows,
      },
      {
        range: 'RINGKASAN_GUDANG!A1',
        values: summaryRows,
      },
    ];

    if (sheetTitles.includes('DATA_PELANGGAN')) {
      updateData.push({ range: 'DATA_PELANGGAN!A1', values: legacyCustomerRows });
    }
    if (sheetTitles.includes('DATA_PEMASOK')) {
      updateData.push({ range: 'DATA_PEMASOK!A1', values: legacySupplierRows });
    }
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
      message: `Semua data (${items.length} produk di "${stockSheetTitle}", ${customers.length} customer di "DATABASE CUSTOMER", ${suppliers.length} supplier di "DATABASE SUPPLIER", ${inTxs.length} pembelian di "HISTORY PEMBELIAN", ${outTxs.length} penjualan di "HISTORY PENJUALAN", ${salesPersons.length} sales di "SALES") berhasil tersimpan ke Google Sheets!`,
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
