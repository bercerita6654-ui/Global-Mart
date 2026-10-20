/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { User } from 'firebase/auth';
import {
  Item,
  Transaction,
  TransactionType,
  SpreadsheetConfig,
  Customer,
  Supplier,
  TARGET_SPREADSHEET_ID,
  TARGET_SPREADSHEET_URL,
  TARGET_SPREADSHEET_TITLE,
} from './types/inventory.js';
import { INITIAL_ITEMS, INITIAL_TRANSACTIONS, INITIAL_CUSTOMERS, INITIAL_SUPPLIERS } from './data/seedData.js';
import {
  calculateStockSummary,
  applyTransactionToItem,
  revertTransactionFromItem,
  getCurrentDateFormatted,
  formatRupiah,
  calculateTierPrices,
} from './utils/inventory.js';
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
  setAccessTokenInMemory,
} from './services/firebaseAuth.js';
import {
  createInventorySpreadsheet,
  appendTransactionToSheet,
  syncFullDataToSheet,
  testSpreadsheetConnection,
  fetchStockListFromSheet,
} from './services/googleSheets.js';

// Components
import { Sidebar } from './components/Sidebar.js';
import { DashboardView } from './components/DashboardView.js';
import { MasterItemsView } from './components/MasterItemsView.js';
import { CustomersView } from './components/CustomersView.js';
import { SuppliersView } from './components/SuppliersView.js';
import { TransactionHistoryView } from './components/TransactionHistoryView.js';
import { ReportsView } from './components/ReportsView.js';
import { TransactionModal } from './components/TransactionModal.js';
import { SpreadsheetModal } from './components/SpreadsheetModal.js';
import { ConfirmationModal } from './components/ConfirmationModal.js';
import { CheckCircle2, AlertCircle, Info, X, ExternalLink, RefreshCw, FileSpreadsheet, Download } from 'lucide-react';

const STORAGE_KEYS = {
  ITEMS: 'stockflow_items_v1',
  TRANSACTIONS: 'stockflow_transactions_v1',
  CUSTOMERS: 'stockflow_customers_v1',
  SUPPLIERS: 'stockflow_suppliers_v1',
  SHEET_CONFIG: 'stockflow_sheet_config_v1',
};

const DEFAULT_SPREADSHEET_CONFIG: SpreadsheetConfig = {
  spreadsheetId: TARGET_SPREADSHEET_ID,
  spreadsheetTitle: TARGET_SPREADSHEET_TITLE,
  spreadsheetUrl: TARGET_SPREADSHEET_URL,
  lastSyncedAt: null,
  autoSync: true,
  sheets: {
    itemsSheet: 'DATA_BARANG',
    transactionsSheet: 'MUTASI_TRANSAKSI',
  },
};

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'master' | 'history' | 'reports' | 'customers' | 'suppliers'>('dashboard');
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');

  // Inventory State with localStorage persistence and fallback to seed
  const [items, setItems] = useState<Item[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ITEMS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load items from storage:', e);
    }
    return INITIAL_ITEMS;
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load customers from storage:', e);
    }
    return INITIAL_CUSTOMERS;
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SUPPLIERS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load suppliers from storage:', e);
    }
    return INITIAL_SUPPLIERS;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load transactions from storage:', e);
    }
    return INITIAL_TRANSACTIONS;
  });

  const [spreadsheetConfig, setSpreadsheetConfig] = useState<SpreadsheetConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SHEET_CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.spreadsheetId) {
          return {
            ...DEFAULT_SPREADSHEET_CONFIG,
            ...parsed,
            spreadsheetId: TARGET_SPREADSHEET_ID,
            spreadsheetUrl: TARGET_SPREADSHEET_URL,
          };
        }
      }
    } catch (e) {
      console.warn('Failed to load spreadsheet config:', e);
    }
    return DEFAULT_SPREADSHEET_CONFIG;
  });

  // Auth & Sync State
  const [user, setUser] = useState<User | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isFetchingFromSheets, setIsFetchingFromSheets] = useState<boolean>(false);

  // Modals State
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [txModalType, setTxModalType] = useState<TransactionType>('IN');
  const [preselectedItemId, setPreselectedItemId] = useState<string | undefined>(undefined);
  const [preselectedRecipient, setPreselectedRecipient] = useState<string>('');
  const [spreadsheetModalOpen, setSpreadsheetModalOpen] = useState(false);

  // Destructive Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Ya, Lanjutkan',
    isDestructive: true,
    onConfirm: () => {},
  });

  // Toast Notification State
  const [toast, setToast] = useState<{
    id: number;
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now();
    setToast({ id, type, message });
    setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 4500);
  }, []);

  // Save to localStorage when state changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    if (spreadsheetConfig) {
      localStorage.setItem(STORAGE_KEYS.SHEET_CONFIG, JSON.stringify(spreadsheetConfig));
    }
  }, [spreadsheetConfig]);

  // Firebase Auth initialization
  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser, token) => {
        setUser(authedUser);
        setAccessTokenInMemory(token);
      },
      () => {
        setUser(null);
        setAccessTokenInMemory(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Summary Metrics
  const summary = calculateStockSummary(items, transactions);

  // Login Handler with auto-sync to the target spreadsheet
  const handleLogin = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        showToast('success', `Berhasil masuk sebagai ${result.user.displayName || result.user.email}`);

        // Automatically sync all data to the target spreadsheet
        setIsSyncing(true);
        try {
          const res = await syncFullDataToSheet(
            result.accessToken,
            spreadsheetConfig.spreadsheetId,
            items,
            transactions,
            customers,
            suppliers
          );
          if (res.success) {
            setSpreadsheetConfig((prev) => ({
              ...prev,
              lastSyncedAt: new Date().toLocaleTimeString('id-ID'),
            }));
            showToast('success', 'Semua data produk & inventaris berhasil tersimpan ke Google Sheets!');
          }
        } catch (syncErr: any) {
          console.warn('Initial sync notice on login:', syncErr);
        } finally {
          setIsSyncing(false);
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      showToast('error', err.message || 'Gagal login ke akun Google.');
    }
  };

  // Logout Handler
  const handleLogout = async () => {
    setConfirmModal({
      isOpen: true,
      title: 'Keluar dari Akun Google',
      message: 'Apakah Anda yakin ingin keluar? Anda tetap dapat melihat dan mengelola data inventaris di browser ini.',
      isDestructive: false,
      onConfirm: async () => {
        await logout();
        setUser(null);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        showToast('info', 'Anda telah keluar dari akun Google.');
      },
    });
  };

  // Quick or Full Sync to Google Sheets (Saves all items, transactions, customers, suppliers)
  const handleFullSync = async () => {
    let token = await getAccessToken();
    if (!token) {
      showToast('info', 'Membuka login Google untuk mengaktifkan izin simpan ke Spreadsheet...');
      try {
        const result = await googleSignIn();
        if (result?.accessToken) {
          setUser(result.user);
          token = result.accessToken;
        } else {
          return;
        }
      } catch (err: any) {
        showToast('error', err.message || 'Gagal login ke akun Google.');
        return;
      }
    }

    setIsSyncing(true);
    try {
      const res = await syncFullDataToSheet(
        token,
        spreadsheetConfig.spreadsheetId,
        items,
        transactions,
        customers,
        suppliers
      );
      if (res.success) {
        const updatedConfig = {
          ...spreadsheetConfig,
          lastSyncedAt: new Date().toLocaleTimeString('id-ID'),
        };
        setSpreadsheetConfig(updatedConfig);
        showToast('success', res.message);
      } else {
        showToast('error', res.message);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menyinkronkan data ke Google Sheets.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Fetch / Import Stock List from sheet " STOCK LIST"
  const handleFetchFromStockListSheet = async () => {
    let token = await getAccessToken();
    if (!token) {
      showToast('info', 'Membuka login Google untuk membaca sheet " STOCK LIST"...');
      try {
        const result = await googleSignIn();
        if (result?.accessToken) {
          setUser(result.user);
          token = result.accessToken;
        } else {
          return;
        }
      } catch (err: any) {
        showToast('error', err.message || 'Gagal login ke akun Google.');
        return;
      }
    }

    setIsFetchingFromSheets(true);
    try {
      const res = await fetchStockListFromSheet(token, spreadsheetConfig.spreadsheetId);
      if (res.items.length > 0) {
        setItems(res.items);
        showToast(
          'success',
          `Berhasil mengambil ${res.count} data barang langsung dari sheet "${res.sheetTitle}"!`
        );
      } else {
        showToast(
          'info',
          `Sheet "${res.sheetTitle}" ditemukan tetapi belum memiliki baris data produk.`
        );
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      showToast('error', err.message || 'Gagal mengambil data dari sheet.');
    } finally {
      setIsFetchingFromSheets(false);
    }
  };

  // Transaction submission handler (with automatic stock separation when incoming modal price differs)
  const handleTransactionSubmit = async (txData: Omit<Transaction, 'id' | 'createdAt'>) => {
    const newTxId = `TRX-${Date.now().toString().slice(-6)}`;
    const newTransaction: Transaction = {
      ...txData,
      id: newTxId,
      createdAt: new Date().toISOString(),
    };

    // Update target item's stock
    const targetItem = items.find((i) => i.id === txData.itemId);
    if (!targetItem) {
      showToast('error', 'Barang tidak ditemukan.');
      return;
    }

    let updatedItems: Item[];
    let recordedTransaction: Transaction = newTransaction;

    // Check if type is 'IN' and incoming modal price is different from targetItem.costPrice
    const targetCost = targetItem.costPrice ?? targetItem.unitPrice ?? 0;
    const isDifferentModalPrice =
      txData.type === 'IN' &&
      txData.unitPrice > 0 &&
      Math.round(txData.unitPrice) !== Math.round(targetCost);

    if (isDifferentModalPrice) {
      // Find if there's already an existing separated variant item with this exact costPrice
      const existingVariant = items.find(
        (i) =>
          i.id !== targetItem.id &&
          (i.sku.startsWith(targetItem.sku) || i.name.startsWith(targetItem.name)) &&
          Math.round(i.costPrice ?? i.unitPrice ?? 0) === Math.round(txData.unitPrice)
      );

      if (existingVariant) {
        const updatedVariant = applyTransactionToItem(existingVariant, {
          type: 'IN',
          quantity: txData.quantity,
          targetWarehouse: txData.targetWarehouse,
        });
        updatedItems = items.map((i) => (i.id === updatedVariant.id ? updatedVariant : i));
        recordedTransaction = {
          ...newTransaction,
          itemId: updatedVariant.id,
          sku: updatedVariant.sku,
          itemName: updatedVariant.name,
        };
        showToast(
          'success',
          `Stok dipisahkan: Ditambahkan ke SKU varian [${updatedVariant.sku}] (${formatRupiah(txData.unitPrice)}) sebanyak ${txData.quantity} ${txData.unit}.`
        );
      } else {
        // Create new separated stock variant
        const baseSku = targetItem.sku.split('-VAR-')[0];
        const existingVariants = items.filter((i) => i.sku.startsWith(baseSku));
        const variantSuffix = String.fromCharCode(65 + existingVariants.length);
        const newSku = `${baseSku}-${variantSuffix}`;
        const margin = targetItem.profitMarginPercent ?? 20;
        const newTiers = calculateTierPrices(txData.unitPrice, margin);

        const isPiranha = txData.targetWarehouse === 'Piranha' || txData.targetWarehouse === 'Gudang Piranha';
        const isToko = txData.targetWarehouse === 'Toko';
        const isGudang = !isPiranha && !isToko;

        const newSeparatedItem: Item = {
          ...targetItem,
          id: `item-${Date.now().toString().slice(-6)}`,
          sku: newSku,
          name: `${targetItem.name} [Modal ${formatRupiah(txData.unitPrice)}]`,
          costPrice: txData.unitPrice,
          unitPrice: newTiers.eceran,
          priceTiers: newTiers,
          priceEceran: newTiers.eceran,
          priceGrosir: newTiers.grosir,
          pricePartai: newTiers.partai,
          currentStock: txData.quantity,
          stockGudang: isGudang ? txData.quantity : 0,
          stockGudangUtama: isGudang ? txData.quantity : 0,
          stockPiranha: isPiranha ? txData.quantity : 0,
          stockGudangPiranha: isPiranha ? txData.quantity : 0,
          stockToko: isToko ? txData.quantity : 0,
          location: txData.targetWarehouse || 'Gudang',
          lastUpdated: new Date().toISOString(),
        };

        updatedItems = [newSeparatedItem, ...items];
        recordedTransaction = {
          ...newTransaction,
          itemId: newSeparatedItem.id,
          sku: newSeparatedItem.sku,
          itemName: newSeparatedItem.name,
        };
        showToast(
          'success',
          `Stok dipisahkan! Dibuat SKU baru [${newSku}] (${formatRupiah(txData.unitPrice)}) untuk ${txData.quantity} ${txData.unit} (${targetItem.name}).`
        );
      }
    } else {
      const updatedItem = applyTransactionToItem(targetItem, {
        type: txData.type,
        quantity: txData.quantity,
        targetWarehouse: txData.targetWarehouse,
      });

      updatedItems = items.map((i) => (i.id === updatedItem.id ? updatedItem : i));
      const warehouseLabel = txData.targetWarehouse ? ` ke ${txData.targetWarehouse}` : '';
      showToast(
        'success',
        `Berhasil mencatat ${txData.type === 'IN' ? 'Barang Masuk (+)' : 'Penjualan (-)'} ${txData.quantity} ${txData.unit} (${txData.itemName})${warehouseLabel}`
      );
    }

    const updatedTransactions = [recordedTransaction, ...transactions];
    setItems(updatedItems);
    setTransactions(updatedTransactions);

    // Auto-sync to Google Sheets if configured and authenticated
    if (spreadsheetConfig?.spreadsheetId && spreadsheetConfig.autoSync) {
      const token = await getAccessToken();
      if (token) {
        setIsSyncing(true);
        try {
          await appendTransactionToSheet(token, spreadsheetConfig.spreadsheetId, recordedTransaction);
          await syncFullDataToSheet(
            token,
            spreadsheetConfig.spreadsheetId,
            updatedItems,
            updatedTransactions,
            customers,
            suppliers
          );
          setSpreadsheetConfig((prev) => ({
            ...prev,
            lastSyncedAt: new Date().toLocaleTimeString('id-ID'),
          }));
        } catch (syncErr) {
          console.warn('Auto-sync failed in background:', syncErr);
        } finally {
          setIsSyncing(false);
        }
      }
    }
  };

  // Add Item Handler
  const handleAddItem = async (newItemData: Omit<Item, 'id' | 'lastUpdated'>) => {
    const newItem: Item = {
      ...newItemData,
      id: `item-${Date.now().toString().slice(-5)}`,
      lastUpdated: new Date().toISOString(),
    };

    const newItemsList = [newItem, ...items];
    setItems(newItemsList);
    showToast('success', `Master barang [${newItem.sku}] ${newItem.name} berhasil ditambahkan.`);

    // If connected to sheets, sync
    if (spreadsheetConfig?.spreadsheetId) {
      const token = await getAccessToken();
      if (token) {
        syncFullDataToSheet(
          token,
          spreadsheetConfig.spreadsheetId,
          newItemsList,
          transactions,
          customers,
          suppliers
        );
      }
    }
  };

  // Update Item Handler
  const handleUpdateItem = async (updatedItem: Item) => {
    const updatedList = items.map((i) => (i.id === updatedItem.id ? updatedItem : i));
    setItems(updatedList);
    showToast('success', `Data barang [${updatedItem.sku}] berhasil diperbarui.`);

    if (spreadsheetConfig?.spreadsheetId) {
      const token = await getAccessToken();
      if (token) {
        syncFullDataToSheet(
          token,
          spreadsheetConfig.spreadsheetId,
          updatedList,
          transactions,
          customers,
          suppliers
        );
      }
    }
  };

  // Delete Item Handler (with confirmation dialog for destructive operation)
  const handleDeleteItem = (itemId: string) => {
    const target = items.find((i) => i.id === itemId);
    if (!target) return;

    setConfirmModal({
      isOpen: true,
      title: `Hapus Master Barang '${target.name}'?`,
      message: `Tindakan ini akan menghapus barang [${target.sku}] ${target.name} secara permanen dari master inventaris. Riwayat transaksi sebelumnya tetap tersimpan di log.`,
      isDestructive: true,
      onConfirm: async () => {
        const remainingItems = items.filter((i) => i.id !== itemId);
        setItems(remainingItems);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        showToast('info', `Barang [${target.sku}] telah dihapus.`);

        if (spreadsheetConfig?.spreadsheetId) {
          const token = await getAccessToken();
          if (token) {
            syncFullDataToSheet(
              token,
              spreadsheetConfig.spreadsheetId,
              remainingItems,
              transactions,
              customers,
              suppliers
            );
          }
        }
      },
    });
  };

  // Delete Transaction Handler (with confirmation and automatic stock adjustment)
  const handleDeleteTransaction = (txId: string) => {
    const tx = transactions.find((t) => t.id === txId);
    if (!tx) return;

    const targetItem = items.find((i) => i.id === tx.itemId);
    const stockNote = targetItem
      ? tx.type === 'IN'
        ? `Stok barang '${targetItem.name}' akan dikurangi kembali sebesar ${tx.quantity} ${tx.unit} (dari ${targetItem.currentStock} menjadi ${Math.max(0, targetItem.currentStock - tx.quantity)} ${tx.unit}).`
        : `Stok barang '${targetItem.name}' akan dikembalikan sebesar ${tx.quantity} ${tx.unit} (dari ${targetItem.currentStock} menjadi ${targetItem.currentStock + tx.quantity} ${tx.unit}).`
      : 'Barang terkait sudah tidak ada di master barang.';

    setConfirmModal({
      isOpen: true,
      title: `Hapus Catatan Mutasi [${tx.id}]?`,
      message: `Apakah Anda yakin ingin menghapus catatan transaksi ${tx.type === 'IN' ? 'Barang Masuk (+)' : 'Barang Keluar (-)'} sebanyak ${tx.quantity} ${tx.unit} (${tx.itemName}) tanggal ${tx.date} jam ${tx.time}?\n\n${stockNote}`,
      confirmLabel: 'Ya, Hapus Mutasi',
      isDestructive: true,
      onConfirm: async () => {
        let updatedItems = items;
        if (targetItem) {
          const revertedItem = revertTransactionFromItem(targetItem, {
            type: tx.type,
            quantity: tx.quantity,
            targetWarehouse: tx.targetWarehouse,
          });
          updatedItems = items.map((i) => (i.id === revertedItem.id ? revertedItem : i));
          setItems(updatedItems);
        }

        const remainingTransactions = transactions.filter((t) => t.id !== txId);
        setTransactions(remainingTransactions);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));

        showToast(
          'info',
          `Transaksi mutasi [${tx.id}] berhasil dihapus dan stok barang telah disesuaikan.`
        );

        if (spreadsheetConfig?.spreadsheetId) {
          const token = await getAccessToken();
          if (token) {
            syncFullDataToSheet(
              token,
              spreadsheetConfig.spreadsheetId,
              updatedItems,
              remainingTransactions,
              customers,
              suppliers
            );
          }
        }
      },
    });
  };

  // Create New Spreadsheet in Google Drive
  const handleCreateNewSheet = async (title: string) => {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Silakan masuk ke Akun Google Anda terlebih dahulu.');
    }

    const { spreadsheetId, spreadsheetUrl } = await createInventorySpreadsheet(
      token,
      title,
      items,
      transactions,
      customers,
      suppliers
    );

    const config: SpreadsheetConfig = {
      spreadsheetId,
      spreadsheetTitle: title,
      spreadsheetUrl,
      lastSyncedAt: new Date().toLocaleTimeString('id-ID'),
      autoSync: true,
      sheets: {
        itemsSheet: 'DATA_BARANG',
        transactionsSheet: 'MUTASI_TRANSAKSI',
      },
    };

    setSpreadsheetConfig(config);
    showToast('success', `Spreadsheet '${title}' berhasil dibuat di Google Drive Anda!`);
  };

  // Connect Existing Spreadsheet ID
  const handleConnectExistingSheet = async (sheetId: string): Promise<boolean> => {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Silakan masuk ke Akun Google Anda terlebih dahulu.');
    }

    const check = await testSpreadsheetConnection(token, sheetId);
    if (!check.valid) {
      return false;
    }

    const title = check.title || 'Google Spreadsheet';
    const config: SpreadsheetConfig = {
      spreadsheetId: sheetId,
      spreadsheetTitle: title,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
      lastSyncedAt: new Date().toLocaleTimeString('id-ID'),
      autoSync: true,
      sheets: {
        itemsSheet: 'DATA_BARANG',
        transactionsSheet: 'MUTASI_TRANSAKSI',
      },
    };

    setSpreadsheetConfig(config);
    // Sync current app data to the newly connected sheet
    await syncFullDataToSheet(token, sheetId, items, transactions, customers, suppliers);
    return true;
  };

  // Customer Handlers
  const handleAddCustomer = (newCustData: Omit<Customer, 'id' | 'createdAt' | 'lastUpdated'>) => {
    const newCust: Customer = {
      ...newCustData,
      id: `cust-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };
    const updatedCustomers = [newCust, ...customers];
    setCustomers(updatedCustomers);
    showToast('success', `Customer [${newCust.code}] ${newCust.name} berhasil ditambahkan.`);

    if (spreadsheetConfig?.spreadsheetId) {
      getAccessToken().then((token) => {
        if (token) {
          syncFullDataToSheet(token, spreadsheetConfig.spreadsheetId, items, transactions, updatedCustomers, suppliers);
        }
      });
    }
  };

  const handleUpdateCustomer = (updatedCust: Customer) => {
    const updatedCustomers = customers.map((c) => (c.id === updatedCust.id ? updatedCust : c));
    setCustomers(updatedCustomers);
    showToast('success', `Data customer [${updatedCust.code}] berhasil diperbarui.`);

    if (spreadsheetConfig?.spreadsheetId) {
      getAccessToken().then((token) => {
        if (token) {
          syncFullDataToSheet(token, spreadsheetConfig.spreadsheetId, items, transactions, updatedCustomers, suppliers);
        }
      });
    }
  };

  const handleDeleteCustomer = (customerId: string) => {
    const target = customers.find((c) => c.id === customerId);
    if (!target) return;

    setConfirmModal({
      isOpen: true,
      title: `Hapus Customer '${target.name}'?`,
      message: `Apakah Anda yakin ingin menghapus data customer [${target.code}] ${target.name}? Riwayat transaksi mutasi yang pernah dibuat untuk customer ini tetap tersimpan.`,
      confirmLabel: 'Ya, Hapus Customer',
      isDestructive: true,
      onConfirm: () => {
        const remainingCustomers = customers.filter((c) => c.id !== customerId);
        setCustomers(remainingCustomers);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        showToast('info', `Customer [${target.code}] ${target.name} telah dihapus.`);

        if (spreadsheetConfig?.spreadsheetId) {
          getAccessToken().then((token) => {
            if (token) {
              syncFullDataToSheet(token, spreadsheetConfig.spreadsheetId, items, transactions, remainingCustomers, suppliers);
            }
          });
        }
      },
    });
  };

  const handleSelectCustomerForTransaction = (cust: Customer) => {
    setTxModalType('OUT');
    setPreselectedRecipient(cust.name);
    setPreselectedItemId(undefined);
    setTransactionModalOpen(true);
  };

  // Supplier Database Handlers
  const handleAddSupplier = (newSupData: Omit<Supplier, 'id' | 'createdAt' | 'lastUpdated'>) => {
    const newSup: Supplier = {
      ...newSupData,
      id: `sup-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };
    const updatedSuppliers = [newSup, ...suppliers];
    setSuppliers(updatedSuppliers);
    showToast('success', `Supplier [${newSup.code}] ${newSup.name} berhasil ditambahkan ke Database.`);

    if (spreadsheetConfig?.spreadsheetId) {
      getAccessToken().then((token) => {
        if (token) {
          syncFullDataToSheet(token, spreadsheetConfig.spreadsheetId, items, transactions, customers, updatedSuppliers);
        }
      });
    }
  };

  const handleUpdateSupplier = (updatedSup: Supplier) => {
    const updatedSuppliers = suppliers.map((s) => (s.id === updatedSup.id ? updatedSup : s));
    setSuppliers(updatedSuppliers);
    showToast('success', `Data supplier [${updatedSup.code}] berhasil diperbarui.`);

    if (spreadsheetConfig?.spreadsheetId) {
      getAccessToken().then((token) => {
        if (token) {
          syncFullDataToSheet(token, spreadsheetConfig.spreadsheetId, items, transactions, customers, updatedSuppliers);
        }
      });
    }
  };

  const handleDeleteSupplier = (supplierId: string) => {
    const target = suppliers.find((s) => s.id === supplierId);
    if (!target) return;

    setConfirmModal({
      isOpen: true,
      title: `Hapus Supplier '${target.name}'?`,
      message: `Apakah Anda yakin ingin menghapus data supplier [${target.code}] ${target.name}? Riwayat transaksi mutasi yang pernah dibuat untuk supplier ini tetap tersimpan.`,
      confirmLabel: 'Ya, Hapus Supplier',
      isDestructive: true,
      onConfirm: () => {
        const remainingSuppliers = suppliers.filter((s) => s.id !== supplierId);
        setSuppliers(remainingSuppliers);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        showToast('info', `Supplier [${target.code}] ${target.name} telah dihapus.`);

        if (spreadsheetConfig?.spreadsheetId) {
          getAccessToken().then((token) => {
            if (token) {
              syncFullDataToSheet(token, spreadsheetConfig.spreadsheetId, items, transactions, customers, remainingSuppliers);
            }
          });
        }
      },
    });
  };

  const handleSelectSupplierForTransaction = (sup: Supplier) => {
    setTxModalType('IN');
    setPreselectedRecipient(sup.name);
    setPreselectedItemId(undefined);
    setTransactionModalOpen(true);
  };

  // Trigger Transaction Modal Helper
  const openTransactionModal = (type: TransactionType = 'IN', itemId?: string, recipient?: string) => {
    setTxModalType(type);
    setPreselectedItemId(itemId);
    setPreselectedRecipient(recipient || '');
    setTransactionModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-row bg-slate-50 text-slate-800">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-top-4 duration-200">
          <div
            className={`flex items-center space-x-3 px-4 py-3 rounded-2xl shadow-xl text-xs sm:text-sm font-semibold border ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20'
                : toast.type === 'error'
                ? 'bg-rose-600 text-white border-rose-500 shadow-rose-500/20'
                : 'bg-slate-900 text-white border-slate-700 shadow-slate-900/20'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 shrink-0" />}
            {toast.type === 'info' && <Info className="w-5 h-5 shrink-0" />}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              aria-label="Tutup notifikasi"
              className="p-1 hover:bg-white/20 rounded-lg ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Vertical Left Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        historyFilter={historyFilter}
        setHistoryFilter={setHistoryFilter}
        user={user}
        spreadsheetConfig={spreadsheetConfig}
        isSyncing={isSyncing}
        onOpenSpreadsheetModal={() => setSpreadsheetModalOpen(true)}
        onQuickSync={handleFullSync}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Target Google Spreadsheet Sync Banner */}
          <div className="mb-6 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 rounded-3xl p-4 sm:p-5 text-white shadow-xl border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center space-x-3.5">
              <div className="p-2.5 bg-emerald-500/20 border border-emerald-400/30 rounded-2xl text-emerald-300 shrink-0">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold text-sm sm:text-base text-white">
                    Google Spreadsheet Target
                  </span>
                  <span className="bg-emerald-500/30 text-emerald-200 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border border-emerald-400/40">
                    ID: {TARGET_SPREADSHEET_ID}
                  </span>
                  {spreadsheetConfig?.lastSyncedAt ? (
                    <span className="text-[11px] text-emerald-300/90 font-medium">
                      (Terakhir Disinkronkan: {spreadsheetConfig.lastSyncedAt})
                    </span>
                  ) : (
                    <span className="text-[11px] text-amber-300 font-medium">
                      (Siap Disimpan)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Menyimpan otomatis seluruh data master produk, stok 3 gudang, riwayat mutasi masuk &amp; keluar, database customer, serta supplier langsung ke spreadsheet Anda.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={handleFetchFromStockListSheet}
                disabled={isFetchingFromSheets}
                className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/25 transition-all cursor-pointer disabled:bg-slate-700"
                title="Ambil dan sinkronkan data barang langsung dari sheet ' STOCK LIST'"
              >
                <Download className={`w-4 h-4 ${isFetchingFromSheets ? 'animate-bounce' : ''}`} />
                <span>{isFetchingFromSheets ? 'Mengambil Data...' : "Tarik dari Sheet 'STOCK LIST'"}</span>
              </button>
              <button
                onClick={handleFullSync}
                disabled={isSyncing}
                className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-500/25 transition-all cursor-pointer disabled:bg-slate-700"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Menyimpan...' : 'Simpan ke Google Sheets'}</span>
              </button>
              <a
                href={spreadsheetConfig?.spreadsheetUrl || TARGET_SPREADSHEET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors border border-white/10"
                title="Buka Google Sheets di tab baru"
              >
                <span>Buka Sheet</span>
                <ExternalLink className="w-3.5 h-3.5 text-emerald-300" />
              </a>
            </div>
          </div>

        {activeTab === 'dashboard' && (
          <DashboardView
            items={items}
            transactions={transactions}
            summary={summary}
            spreadsheetConfig={spreadsheetConfig}
            onOpenTransactionModal={openTransactionModal}
            onOpenAddItemModal={() => {
              setActiveTab('master');
            }}
            onOpenSpreadsheetModal={() => setSpreadsheetModalOpen(true)}
            onViewAllHistory={() => {
              setActiveTab('history');
              setHistoryFilter('ALL');
            }}
            onViewAllMaster={() => setActiveTab('master')}
            onQuickSync={handleFullSync}
            isSyncing={isSyncing}
          />
        )}


        {activeTab === 'master' && (
          <MasterItemsView
            items={items}
            onAddItem={handleAddItem}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
            onOpenTransactionModal={(type, itemId) => openTransactionModal(type, itemId)}
            onSyncToSheets={handleFullSync}
            onFetchFromSheets={handleFetchFromStockListSheet}
            isSyncing={isSyncing}
            isFetchingFromSheets={isFetchingFromSheets}
            spreadsheetUrl={spreadsheetConfig?.spreadsheetUrl}
          />
        )}

        {activeTab === 'customers' && (
          <CustomersView
            customers={customers}
            onAddCustomer={handleAddCustomer}
            onUpdateCustomer={handleUpdateCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onSelectCustomerForTransaction={handleSelectCustomerForTransaction}
          />
        )}

        {activeTab === 'suppliers' && (
          <SuppliersView
            suppliers={suppliers}
            onAddSupplier={handleAddSupplier}
            onUpdateSupplier={handleUpdateSupplier}
            onDeleteSupplier={handleDeleteSupplier}
            onSelectSupplierForTransaction={handleSelectSupplierForTransaction}
          />
        )}

        {activeTab === 'history' && (
          <TransactionHistoryView
            transactions={transactions}
            spreadsheetConfig={spreadsheetConfig}
            onOpenTransactionModal={openTransactionModal}
            onDeleteTransaction={handleDeleteTransaction}
            initialTypeFilter={historyFilter}
            onTypeFilterChange={setHistoryFilter}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            items={items}
            transactions={transactions}
            summary={summary}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} Global Mart • Sistem Keluar Masuk Barang & Google Sheets API</p>
          <p className="flex items-center space-x-2">
            <span>Sinkronisasi Google Sheets V4</span>
            <span>•</span>
            <span>Real-time Warehouse Management</span>
          </p>
        </div>
      </footer>
      </div>

      {/* Transaction Input Modal */}
      <TransactionModal
        isOpen={transactionModalOpen}
        onClose={() => setTransactionModalOpen(false)}
        items={items}
        customers={customers}
        suppliers={suppliers}
        transactions={transactions}
        defaultType={txModalType}
        preselectedItemId={preselectedItemId}
        initialRecipient={preselectedRecipient}
        defaultOperator={user?.displayName || 'Petugas Gudang'}
        onSubmit={handleTransactionSubmit}
      />

      {/* Google Sheets Sync Hub Modal */}
      <SpreadsheetModal
        isOpen={spreadsheetModalOpen}
        onClose={() => setSpreadsheetModalOpen(false)}
        user={user}
        spreadsheetConfig={spreadsheetConfig}
        items={items}
        transactions={transactions}
        isSyncing={isSyncing}
        onLogin={handleLogin}
        onCreateNewSheet={handleCreateNewSheet}
        onConnectExistingSheet={handleConnectExistingSheet}
        onTriggerFullSync={handleFullSync}
        onToggleAutoSync={(enabled) => {
          setSpreadsheetConfig((prev) => ({ ...prev, autoSync: enabled }));
          showToast('info', `Sinkronisasi otomatis ${enabled ? 'diaktifkan' : 'dinonaktifkan'}.`);
        }}
      />

      {/* Mandatory Destructive Action Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        isDestructive={confirmModal.isDestructive}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
