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
  UserAccount,
  UserRole,
  SALES_PERSONS,
  TARGET_SPREADSHEET_ID,
  TARGET_SPREADSHEET_URL,
  TARGET_SPREADSHEET_TITLE,
} from './types/inventory.js';
import {
  INITIAL_ITEMS,
  INITIAL_TRANSACTIONS,
  INITIAL_CUSTOMERS,
  INITIAL_SUPPLIERS,
  INITIAL_ACCOUNTS,
} from './data/seedData.js';
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
  appendCustomerToSheet,
  appendSupplierToSheet,
  appendItemToSheet,
  appendSalesToSheet,
  appendAccountToSheet,
  syncFullDataToSheet,
  testSpreadsheetConnection,
  fetchStockListFromSheet,
  fetchCustomersFromSheet,
  fetchSuppliersFromSheet,
  fetchTransactionsFromSheets,
  fetchSalesFromSheet,
  fetchAccountsFromSheet,
} from './services/googleSheets.js';

// Components
import { Sidebar } from './components/Sidebar.js';
import { DashboardView } from './components/DashboardView.js';
import { MasterItemsView } from './components/MasterItemsView.js';
import { CustomersView } from './components/CustomersView.js';
import { SuppliersView } from './components/SuppliersView.js';
import { TransactionHistoryView } from './components/TransactionHistoryView.js';
import { ReportsView } from './components/ReportsView.js';
import { AccountsView } from './components/AccountsView.js';
import { LoginModal } from './components/LoginModal.js';
import { TransactionModal } from './components/TransactionModal.js';
import { SpreadsheetModal } from './components/SpreadsheetModal.js';
import { ConfirmationModal } from './components/ConfirmationModal.js';
import { CheckCircle2, AlertCircle, Info, X, ExternalLink, RefreshCw, FileSpreadsheet, Download, ShieldCheck, UserCheck } from 'lucide-react';

const STORAGE_KEYS = {
  ITEMS: 'stockflow_items_v2',
  TRANSACTIONS: 'stockflow_transactions_v1',
  CUSTOMERS: 'stockflow_customers_v1',
  SUPPLIERS: 'stockflow_suppliers_v1',
  SALES: 'stockflow_sales_v1',
  ACCOUNTS: 'stockflow_accounts_v1',
  ACTIVE_USER: 'stockflow_active_user_v1',
  SHEET_CONFIG: 'stockflow_sheet_config_v1',
};

function sanitizeStoredItems(storedItems: Item[]): Item[] {
  if (!Array.isArray(storedItems)) return INITIAL_ITEMS;
  return storedItems.map((item) => {
    // If SKU 06723 was corrupted by old parser (priceEceran <= 10 or costPrice <= 10):
    const eceran = item.priceEceran ?? 0;
    const cost = item.costPrice ?? 0;

    if (item.sku === '06723' && (eceran <= 10 || cost <= 10)) {
      return {
        ...item,
        costPrice: 2700,
        unitPrice: 2700,
        priceEceran: 4000,
        priceGrosir: 3300,
        pricePartai: 3200,
        priceTiers: { eceran: 4000, grosir: 3300, partai: 3200 },
        stockGudang: 2230,
        stockGudangUtama: 2230,
        stockToko: 340,
        stockPiranha: 0,
        stockGudangPiranha: 0,
        currentStock: 2570,
      };
    }
    if (item.sku === '06724' && (eceran <= 10 || cost <= 10)) {
      return {
        ...item,
        costPrice: 3850,
        unitPrice: 3850,
        priceEceran: 5500,
        priceGrosir: 4600,
        pricePartai: 4400,
        priceTiers: { eceran: 5500, grosir: 4600, partai: 4400 },
        stockGudang: 130,
        stockGudangUtama: 130,
        stockToko: 280,
        stockPiranha: 0,
        currentStock: 410,
      };
    }
    if (item.sku === '01981' && (eceran <= 10 || cost <= 10)) {
      return {
        ...item,
        costPrice: 3950,
        unitPrice: 3950,
        priceEceran: 5600,
        priceGrosir: 4950,
        pricePartai: 4700,
        priceTiers: { eceran: 5600, grosir: 4950, partai: 4700 },
        stockGudang: 20,
        stockGudangUtama: 20,
        stockToko: 400,
        stockPiranha: 0,
        currentStock: 420,
      };
    }
    if (item.sku === '14502' && (eceran <= 10 || cost <= 10)) {
      return {
        ...item,
        costPrice: 845,
        unitPrice: 845,
        priceEceran: 1300,
        priceGrosir: 925,
        pricePartai: 910,
        priceTiers: { eceran: 1300, grosir: 925, partai: 910 },
        stockGudang: 12769,
        stockGudangUtama: 12769,
        stockToko: 42207,
        stockPiranha: 0,
        currentStock: 54976,
      };
    }
    return item;
  });
}

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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'master' | 'history' | 'reports' | 'customers' | 'suppliers' | 'accounts'>('dashboard');
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');

  // Inventory State with localStorage persistence and fallback to seed
  const [items, setItems] = useState<Item[]>(() => {
    try {
      const savedV2 = localStorage.getItem(STORAGE_KEYS.ITEMS);
      if (savedV2) return sanitizeStoredItems(JSON.parse(savedV2));
      const savedV1 = localStorage.getItem('stockflow_items_v1');
      if (savedV1) return sanitizeStoredItems(JSON.parse(savedV1));
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

  const [salesPersons, setSalesPersons] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SALES);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load sales persons:', e);
    }
    return [...SALES_PERSONS];
  });

  const [accounts, setAccounts] = useState<UserAccount[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load accounts from storage:', e);
    }
    return INITIAL_ACCOUNTS;
  });

  const [activeUser, setActiveUser] = useState<UserAccount | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load active user from storage:', e);
    }
    return null;
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
  const [isFetchingCustomers, setIsFetchingCustomers] = useState<boolean>(false);
  const [isFetchingSuppliers, setIsFetchingSuppliers] = useState<boolean>(false);
  const [isFetchingTransactions, setIsFetchingTransactions] = useState<boolean>(false);
  const [isFetchingAccounts, setIsFetchingAccounts] = useState<boolean>(false);

  // Modals State
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [txModalType, setTxModalType] = useState<TransactionType>('IN');
  const [preselectedItemId, setPreselectedItemId] = useState<string | undefined>(undefined);
  const [preselectedRecipient, setPreselectedRecipient] = useState<string>('');
  const [spreadsheetModalOpen, setSpreadsheetModalOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER);
      return !saved;
    } catch {
      return true;
    }
  });

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
    localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(salesPersons));
  }, [salesPersons]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    if (activeUser) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_USER, JSON.stringify(activeUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER);
    }
  }, [activeUser]);

  useEffect(() => {
    if (activeTab === 'accounts' && activeUser?.username !== 'server') {
      setActiveTab('dashboard');
    }
  }, [activeTab, activeUser]);

  useEffect(() => {
    if (activeUser && accounts.length > 0) {
      const stillExists = accounts.some(
        (a) => a.id === activeUser.id || a.username.toLowerCase() === activeUser.username.toLowerCase()
      );
      if (!stillExists) {
        setActiveUser(null);
        showToast('error', 'Akun Anda sudah dihapus atau tidak terdaftar lagi pada sheet AKUN. Anda telah keluar otomatis.');
      }
    }
  }, [accounts, activeUser]);

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

  // Auto-fetch from target sheets on initial load to ensure up-to-date data:
  // - "STOCK LIST" -> Items
  // - "DATABASE CUSTOMER" -> Customers
  // - "DATABASE SUPPLIER" -> Suppliers
  // - "HISTORY PEMBELIAN" & "HISTORY PENJUALAN" -> Transactions
  // - "SALES" -> Sales Representatives
  useEffect(() => {
    let isCancelled = false;
    const fetchLatest = async () => {
      try {
        const token = await getAccessToken();
        const id = spreadsheetConfig.spreadsheetId;

        // 1. Stock List ("STOCK LIST")
        try {
          const resItems = await fetchStockListFromSheet(token, id);
          if (!isCancelled && resItems.items && resItems.items.length > 0) {
            setItems(resItems.items);
          }
        } catch (err) {
          console.warn('Initial stock sync notice:', err);
        }

        // 2. Customers ("DATABASE CUSTOMER")
        try {
          const resCust = await fetchCustomersFromSheet(token, id);
          if (!isCancelled && resCust.customers && resCust.customers.length > 0) {
            setCustomers(resCust.customers);
          }
        } catch (err) {
          console.warn('Initial customer sync notice:', err);
        }

        // 3. Suppliers ("DATABASE SUPPLIER")
        try {
          const resSupp = await fetchSuppliersFromSheet(token, id);
          if (!isCancelled && resSupp.suppliers && resSupp.suppliers.length > 0) {
            setSuppliers(resSupp.suppliers);
          }
        } catch (err) {
          console.warn('Initial supplier sync notice:', err);
        }

        // 4. History Pembelian & Penjualan
        try {
          const resTxs = await fetchTransactionsFromSheets(token, id);
          if (!isCancelled && resTxs.transactions && resTxs.transactions.length > 0) {
            setTransactions(resTxs.transactions);
          }
        } catch (err) {
          console.warn('Initial transactions sync notice:', err);
        }

        // 5. Sales Representatives ("SALES")
        try {
          const resSales = await fetchSalesFromSheet(token, id);
          if (!isCancelled && resSales.length > 0) {
            setSalesPersons(resSales);
          }
        } catch (err) {
          console.warn('Initial sales sync notice:', err);
        }

        // 6. User Accounts ("AKUN")
        try {
          const resAccounts = await fetchAccountsFromSheet(token, id);
          if (!isCancelled && resAccounts.accounts && resAccounts.accounts.length > 0) {
            setAccounts(resAccounts.accounts);
            // Sync activeUser if still present
            setActiveUser((prevActive) => {
              if (!prevActive) return resAccounts.accounts[0] || null;
              const matched = resAccounts.accounts.find(
                (a) => a.id === prevActive.id || a.username === prevActive.username
              );
              return matched || prevActive;
            });
          }
        } catch (err) {
          console.warn('Initial accounts sync notice:', err);
        }
      } catch (err) {
        console.warn('Initial background sync error:', err);
      }
    };
    fetchLatest();
    return () => {
      isCancelled = true;
    };
  }, [spreadsheetConfig.spreadsheetId]);

  // Summary Metrics
  const summary = calculateStockSummary(items, transactions);

  // Login Handler with auto-sync and auto-fetch from Google Sheets
  const handleLogin = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        showToast('success', `Berhasil masuk sebagai ${result.user.displayName || result.user.email}`);

        // Automatically fetch latest data from respective sheets upon login
        setIsSyncing(true);
        try {
          const token = result.accessToken;
          const id = spreadsheetConfig.spreadsheetId;
          const [resItems, resCust, resSupp, resTxs, resSales, resAccounts] = await Promise.all([
            fetchStockListFromSheet(token, id).catch(() => ({ items: [], count: 0 })),
            fetchCustomersFromSheet(token, id).catch(() => ({ customers: [], count: 0 })),
            fetchSuppliersFromSheet(token, id).catch(() => ({ suppliers: [], count: 0 })),
            fetchTransactionsFromSheets(token, id).catch(() => ({ transactions: [], count: 0 })),
            fetchSalesFromSheet(token, id).catch(() => []),
            fetchAccountsFromSheet(token, id).catch(() => ({ accounts: [], count: 0 })),
          ]);

          if (resItems.items.length > 0) setItems(resItems.items);
          if (resCust.customers.length > 0) setCustomers(resCust.customers);
          if (resSupp.suppliers.length > 0) setSuppliers(resSupp.suppliers);
          if (resTxs.transactions.length > 0) setTransactions(resTxs.transactions);
          if (resSales.length > 0) setSalesPersons(resSales);
          if (resAccounts.accounts.length > 0) setAccounts(resAccounts.accounts);

          showToast('success', 'Data aplikasi berhasil disinkronkan otomatis dari Google Spreadsheet!');
        } catch (fetchErr: any) {
          console.warn('Auto fetch on login notice:', fetchErr);
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

  // Quick or Full Sync to Google Sheets (Saves all items, transactions, customers, suppliers, sales)
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
        suppliers,
        salesPersons,
        accounts
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

  // Fetch Accounts directly from sheet "AKUN"
  const handleFetchAccountsFromSheet = async () => {
    setIsFetchingAccounts(true);
    try {
      const token = await getAccessToken();
      const res = await fetchAccountsFromSheet(token, spreadsheetConfig.spreadsheetId);
      if (res.accounts.length > 0) {
        setAccounts(res.accounts);
        showToast(
          'success',
          `Berhasil mengambil ${res.count} data akun langsung dari sheet "${res.sheetTitle}"!`
        );
      } else {
        showToast(
          'info',
          `Sheet "${res.sheetTitle}" ditemukan. Belum ada baris akun baru.`
        );
      }
    } catch (err: any) {
      console.error('Fetch accounts error:', err);
      showToast('error', err.message || 'Gagal mengambil data akun dari sheet.');
    } finally {
      setIsFetchingAccounts(false);
    }
  };

  // Account Handlers (Otomatis masuk ke sheet "AKUN")
  const handleAddAccount = (newAcc: UserAccount) => {
    const updated = [newAcc, ...accounts];
    setAccounts(updated);
    showToast('success', `Akun [${newAcc.username}] (${newAcc.name}) berhasil ditambahkan.`);
    autoSyncMutationToSheets('ACCOUNT', {
      newAccounts: updated,
      singleAccount: newAcc,
    });
  };

  const handleUpdateAccount = (updatedAcc: UserAccount) => {
    const updated = accounts.map((a) => (a.id === updatedAcc.id ? updatedAcc : a));
    setAccounts(updated);
    // If activeUser is updated, update activeUser as well
    if (activeUser && activeUser.id === updatedAcc.id) {
      setActiveUser(updatedAcc);
    }
    showToast('success', `Data akun [${updatedAcc.username}] berhasil diperbarui.`);
    autoSyncMutationToSheets('ACCOUNT', {
      newAccounts: updated,
      singleAccount: updatedAcc,
    });
  };

  const handleDeleteAccount = (accId: string) => {
    const target = accounts.find((a) => a.id === accId);
    if (!target) return;
    if (accounts.length <= 1) {
      showToast('error', 'Tidak dapat menghapus seluruh akun. Sisakan minimal 1 akun aktif.');
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: `Hapus Akun '${target.username}'?`,
      message: `Apakah Anda yakin ingin menghapus akun [${target.username}] ${target.name}? Pengguna ini tidak akan dapat login kembali.`,
      confirmLabel: 'Ya, Hapus Akun',
      isDestructive: true,
      onConfirm: () => {
        const remaining = accounts.filter((a) => a.id !== accId);
        setAccounts(remaining);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        showToast('info', `Akun [${target.username}] telah dihapus.`);
        autoSyncMutationToSheets('ACCOUNT', {
          newAccounts: remaining,
        });
      },
    });
  };

  const handleLoginAccount = (acc: UserAccount) => {
    setActiveUser(acc);
    // Update lastLogin on account
    const updatedTime = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const updatedAcc = { ...acc, lastLogin: updatedTime };
    setAccounts((prev) => prev.map((a) => (a.id === acc.id ? updatedAcc : a)));
    showToast('success', `Berhasil Masuk sebagai ${acc.name} (${acc.role})!`);
  };

  const handleLogoutAccount = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Keluar dari Akun Pengguna',
      message: 'Apakah Anda ingin keluar dari akun saat ini?',
      confirmLabel: 'Ya, Keluar Akun',
      isDestructive: false,
      onConfirm: () => {
        setActiveUser(null);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        showToast('info', 'Anda telah keluar dari akun pengguna.');
        setLoginModalOpen(true);
      },
    });
  };

  // Fetch / Import Stock List from sheet " STOCK LIST"
  const handleFetchFromStockListSheet = async () => {
    setIsFetchingFromSheets(true);
    try {
      const token = await getAccessToken();
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

  // Fetch Customers directly from sheet "DATABASE CUSTOMER"
  const handleFetchCustomersFromSheet = async () => {
    setIsFetchingCustomers(true);
    try {
      const token = await getAccessToken();
      const res = await fetchCustomersFromSheet(token, spreadsheetConfig.spreadsheetId);
      if (res.customers.length > 0) {
        setCustomers(res.customers);
        showToast(
          'success',
          `Berhasil mengambil ${res.count} data pelanggan langsung dari sheet "${res.sheetTitle}"!`
        );
      } else {
        showToast(
          'info',
          `Sheet "${res.sheetTitle}" ditemukan. Jika baru dibuat, silakan isi baris data customer atau klik Simpan ke Google Sheets.`
        );
      }
    } catch (err: any) {
      console.error('Fetch customer error:', err);
      showToast('error', err.message || 'Gagal mengambil data customer dari sheet.');
    } finally {
      setIsFetchingCustomers(false);
    }
  };

  // Fetch Suppliers directly from sheet "DATABASE SUPPLIER"
  const handleFetchSuppliersFromSheet = async () => {
    setIsFetchingSuppliers(true);
    try {
      const token = await getAccessToken();
      const res = await fetchSuppliersFromSheet(token, spreadsheetConfig.spreadsheetId);
      if (res.suppliers.length > 0) {
        setSuppliers(res.suppliers);
        showToast(
          'success',
          `Berhasil mengambil ${res.count} data supplier langsung dari sheet "${res.sheetTitle}"!`
        );
      } else {
        showToast(
          'info',
          `Sheet "${res.sheetTitle}" ditemukan. Belum ada baris distributor/vendor baru.`
        );
      }
    } catch (err: any) {
      console.error('Fetch supplier error:', err);
      showToast('error', err.message || 'Gagal mengambil data supplier dari sheet.');
    } finally {
      setIsFetchingSuppliers(false);
    }
  };

  // Fetch Transactions directly from sheets "HISTORY PEMBELIAN" and "HISTORY PENJUALAN"
  const handleFetchTransactionsFromSheet = async () => {
    setIsFetchingTransactions(true);
    try {
      const token = await getAccessToken();
      const res = await fetchTransactionsFromSheets(token, spreadsheetConfig.spreadsheetId);
      if (res.transactions.length > 0) {
        setTransactions(res.transactions);
        showToast(
          'success',
          `Berhasil mengambil ${res.count} riwayat mutasi dari sheet "HISTORY PEMBELIAN" & "PENJUALAN"!`
        );
      } else {
        showToast(
          'info',
          'Sheet riwayat mutasi ditemukan tetapi belum memiliki baris data mutasi transaksi baru.'
        );
      }
    } catch (err: any) {
      console.error('Fetch transactions error:', err);
      showToast('error', err.message || 'Gagal mengambil data riwayat mutasi dari sheet.');
    } finally {
      setIsFetchingTransactions(false);
    }
  };

  // Fetch All data from sheets at once
  const handleFetchAllFromSheets = async () => {
    setIsFetchingFromSheets(true);
    showToast('info', 'Sedang mengambil seluruh data dari spreadsheet Google Sheets...');
    try {
      const token = await getAccessToken();
      const id = spreadsheetConfig.spreadsheetId;
      const [resItems, resCust, resSupp, resTxs, resSales] = await Promise.all([
        fetchStockListFromSheet(token, id).catch(() => ({ items: [], sheetTitle: 'STOCK LIST', count: 0 })),
        fetchCustomersFromSheet(token, id).catch(() => ({ customers: [], sheetTitle: 'DATABASE CUSTOMER', count: 0 })),
        fetchSuppliersFromSheet(token, id).catch(() => ({ suppliers: [], sheetTitle: 'DATABASE SUPPLIER', count: 0 })),
        fetchTransactionsFromSheets(token, id).catch(() => ({ transactions: [], count: 0 })),
        fetchSalesFromSheet(token, id).catch(() => []),
      ]);

      let summaryMsg = [];
      if (resItems.items.length > 0) {
        setItems(resItems.items);
        summaryMsg.push(`${resItems.items.length} produk`);
      }
      if (resCust.customers.length > 0) {
        setCustomers(resCust.customers);
        summaryMsg.push(`${resCust.customers.length} customer`);
      }
      if (resSupp.suppliers.length > 0) {
        setSuppliers(resSupp.suppliers);
        summaryMsg.push(`${resSupp.suppliers.length} supplier`);
      }
      if (resTxs.transactions.length > 0) {
        setTransactions(resTxs.transactions);
        summaryMsg.push(`${resTxs.transactions.length} mutasi`);
      }
      if (resSales.length > 0) {
        setSalesPersons(resSales);
        summaryMsg.push(`${resSales.length} tim sales`);
      }

      if (summaryMsg.length > 0) {
        showToast('success', `Tarik data berhasil: ${summaryMsg.join(', ')} diperbarui dari spreadsheet!`);
      } else {
        showToast('info', 'Spreadsheet terhubung. Tidak ada perubahan data baru dari Google Sheets.');
      }
    } catch (err: any) {
      console.error('Fetch all error:', err);
      showToast('error', err.message || 'Gagal mengambil seluruh data dari spreadsheet.');
    } finally {
      setIsFetchingFromSheets(false);
    }
  };

  // Centralized Auto-Sync Dispatcher to ensure all inputs automatically go into their respective sheet in Google Sheets:
  // - Transaction OUT -> Sheet "HISTORY PENJUALAN" & updates "STOCK LIST" & "MUTASI_TRANSAKSI"
  // - Transaction IN  -> Sheet "HISTORY PEMBELIAN" & updates "STOCK LIST" & "MUTASI_TRANSAKSI"
  // - Customer        -> Sheet "DATABASE CUSTOMER"
  // - Supplier        -> Sheet "DATABASE SUPPLIER"
  // - Item            -> Sheet "STOCK LIST"
  // - Sales           -> Sheet "SALES"
  const autoSyncMutationToSheets = async (
    actionType: 'TRANSACTION' | 'ITEM' | 'CUSTOMER' | 'SUPPLIER' | 'SALES' | 'ACCOUNT',
    payload: {
      newItems?: Item[];
      newTransactions?: Transaction[];
      newCustomers?: Customer[];
      newSuppliers?: Supplier[];
      newSalesPersons?: string[];
      newAccounts?: UserAccount[];
      singleTx?: Transaction;
      singleCust?: Customer;
      singleSupp?: Supplier;
      singleItem?: Item;
      singleSales?: string;
      singleAccount?: UserAccount;
    }
  ) => {
    const spreadsheetId = spreadsheetConfig?.spreadsheetId || TARGET_SPREADSHEET_ID;
    if (!spreadsheetId) return;

    const token = await getAccessToken();
    if (!token) {
      showToast(
        'info',
        'Data tersimpan di aplikasi! Masuk Akun Google di kanan atas agar otomatis masuk ke Google Sheets.'
      );
      return;
    }

    setIsSyncing(true);
    try {
      // 1. Direct row append to target sheet
      if (actionType === 'TRANSACTION' && payload.singleTx) {
        await appendTransactionToSheet(token, spreadsheetId, payload.singleTx);
      } else if (actionType === 'CUSTOMER' && payload.singleCust) {
        await appendCustomerToSheet(token, spreadsheetId, payload.singleCust);
      } else if (actionType === 'SUPPLIER' && payload.singleSupp) {
        await appendSupplierToSheet(token, spreadsheetId, payload.singleSupp);
      } else if (actionType === 'ITEM' && payload.singleItem) {
        await appendItemToSheet(token, spreadsheetId, payload.singleItem);
      } else if (actionType === 'SALES' && payload.singleSales) {
        await appendSalesToSheet(token, spreadsheetId, payload.singleSales);
      } else if (actionType === 'ACCOUNT' && payload.singleAccount) {
        await appendAccountToSheet(token, spreadsheetId, payload.singleAccount);
      }

      // 2. Full synchronization across all sheets
      const res = await syncFullDataToSheet(
        token,
        spreadsheetId,
        payload.newItems || items,
        payload.newTransactions || transactions,
        payload.newCustomers || customers,
        payload.newSuppliers || suppliers,
        payload.newSalesPersons || salesPersons,
        payload.newAccounts || accounts
      );

      if (res.success) {
        setSpreadsheetConfig((prev) => ({
          ...prev,
          lastSyncedAt: new Date().toLocaleTimeString('id-ID'),
        }));

        const targetSheetLabel =
          actionType === 'TRANSACTION'
            ? payload.singleTx?.type === 'IN'
              ? 'HISTORY PEMBELIAN & STOCK LIST'
              : 'HISTORY PENJUALAN & STOCK LIST'
            : actionType === 'CUSTOMER'
            ? 'DATABASE CUSTOMER'
            : actionType === 'SUPPLIER'
            ? 'DATABASE SUPPLIER'
            : actionType === 'ITEM'
            ? 'STOCK LIST'
            : actionType === 'SALES'
            ? 'SALES'
            : 'AKUN';

        showToast('success', `Otomatis tersimpan ke spreadsheet: sheet "${targetSheetLabel}"!`);
      }
    } catch (err: any) {
      console.warn('Auto-sync error:', err);
    } finally {
      setIsSyncing(false);
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
    let updatedSales = salesPersons;
    if (txData.salesPerson && !salesPersons.includes(txData.salesPerson)) {
      updatedSales = [...salesPersons, txData.salesPerson];
      setSalesPersons(updatedSales);
    }

    setItems(updatedItems);
    setTransactions(updatedTransactions);

    // Otomatis simpan ke spreadsheet sesuai sheet masing-masing:
    // - HISTORY PENJUALAN / PEMBELIAN
    // - STOCK LIST (stok terpotong/bertambah)
    // - MUTASI_TRANSAKSI (log gabungan)
    await autoSyncMutationToSheets('TRANSACTION', {
      singleTx: recordedTransaction,
      newItems: updatedItems,
      newTransactions: updatedTransactions,
      newSalesPersons: updatedSales,
    });
  };

  // Batch / Multi-SKU Transaction submission handler
  const handleBatchTransactionSubmit = async (txDataList: Array<Omit<Transaction, 'id' | 'createdAt'>>) => {
    if (!txDataList || txDataList.length === 0) return;

    if (txDataList.length === 1) {
      await handleTransactionSubmit(txDataList[0]);
      return;
    }

    let currentItemsState = [...items];
    const newRecordedTransactions: Transaction[] = [];
    const baseTimestamp = Date.now();

    for (let index = 0; index < txDataList.length; index++) {
      const txData = txDataList[index];
      const targetItem = currentItemsState.find((i) => i.id === txData.itemId);
      if (!targetItem) continue;

      const newTxId = `TRX-${(baseTimestamp + index).toString().slice(-6)}`;
      const newTransaction: Transaction = {
        ...txData,
        id: newTxId,
        createdAt: new Date(baseTimestamp + index * 1000).toISOString(),
      };

      const updatedItem = applyTransactionToItem(targetItem, {
        type: txData.type,
        quantity: txData.quantity,
        targetWarehouse: txData.targetWarehouse,
      });

      currentItemsState = currentItemsState.map((i) => (i.id === updatedItem.id ? updatedItem : i));
      newRecordedTransactions.push(newTransaction);
    }

    if (newRecordedTransactions.length === 0) {
      showToast('error', 'Tidak ada barang valid untuk diproses.');
      return;
    }

    const updatedTransactions = [...newRecordedTransactions, ...transactions];
    let updatedSales = salesPersons;
    const firstTx = newRecordedTransactions[0];
    if (firstTx.salesPerson && !salesPersons.includes(firstTx.salesPerson)) {
      updatedSales = [...salesPersons, firstTx.salesPerson];
      setSalesPersons(updatedSales);
    }

    setItems(currentItemsState);
    setTransactions(updatedTransactions);

    const totalQty = newRecordedTransactions.reduce((acc, t) => acc + t.quantity, 0);
    const totalAmount = newRecordedTransactions.reduce((acc, t) => acc + t.totalPrice, 0);
    const recipient = firstTx.recipientOrSupplier || 'Pelanggan';

    showToast(
      'success',
      `Berhasil mencatat Penjualan Multi-SKU (${newRecordedTransactions.length} produk, total ${totalQty} item) untuk ${recipient} sebesar ${formatRupiah(totalAmount)}!`
    );

    // Auto-sync every recorded transaction row to Google Sheets
    const spreadsheetId = spreadsheetConfig?.spreadsheetId || TARGET_SPREADSHEET_ID;
    if (spreadsheetId) {
      const token = await getAccessToken();
      if (!token) {
        showToast(
          'info',
          'Data tersimpan di aplikasi! Masuk Akun Google di kanan atas agar otomatis masuk ke Google Sheets.'
        );
        return;
      }

      setIsSyncing(true);
      try {
        // Direct append each transaction to HISTORY PENJUALAN
        for (const tx of newRecordedTransactions) {
          await appendTransactionToSheet(token, spreadsheetId, tx);
        }

        // Full sync to update STOCK LIST with all deducted stocks
        const res = await syncFullDataToSheet(
          token,
          spreadsheetId,
          currentItemsState,
          updatedTransactions,
          customers,
          suppliers,
          updatedSales
        );

        if (res.success) {
          setSpreadsheetConfig((prev) => ({
            ...prev,
            lastSyncedAt: new Date().toLocaleTimeString('id-ID'),
          }));
          showToast('success', `Otomatis masuk ke spreadsheet pada sheet "HISTORY PENJUALAN" & "STOCK LIST"!`);
        }
      } catch (syncErr) {
        console.warn('Batch auto-sync error:', syncErr);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  // Add Item Handler (Otomatis masuk ke sheet "STOCK LIST")
  const handleAddItem = async (newItemData: Omit<Item, 'id' | 'lastUpdated'>) => {
    const newItem: Item = {
      ...newItemData,
      id: `item-${Date.now().toString().slice(-5)}`,
      lastUpdated: new Date().toISOString(),
    };

    const newItemsList = [newItem, ...items];
    setItems(newItemsList);
    showToast('success', `Master barang [${newItem.sku}] ${newItem.name} berhasil ditambahkan.`);

    // Otomatis sync ke sheet "STOCK LIST"
    await autoSyncMutationToSheets('ITEM', {
      singleItem: newItem,
      newItems: newItemsList,
    });
  };

  // Update Item Handler (Otomatis perbarui di sheet "STOCK LIST")
  const handleUpdateItem = async (updatedItem: Item) => {
    const updatedList = items.map((i) => (i.id === updatedItem.id ? updatedItem : i));
    setItems(updatedList);
    showToast('success', `Data barang [${updatedItem.sku}] berhasil diperbarui.`);

    // Otomatis sync ke sheet "STOCK LIST"
    await autoSyncMutationToSheets('ITEM', {
      singleItem: updatedItem,
      newItems: updatedList,
    });
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

        await autoSyncMutationToSheets('ITEM', {
          newItems: remainingItems,
        });
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

        await autoSyncMutationToSheets('TRANSACTION', {
          newItems: updatedItems,
          newTransactions: remainingTransactions,
        });
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

  // Customer Handlers (Otomatis masuk ke sheet "DATABASE CUSTOMER")
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

    autoSyncMutationToSheets('CUSTOMER', {
      singleCust: newCust,
      newCustomers: updatedCustomers,
    });
  };

  const handleUpdateCustomer = (updatedCust: Customer) => {
    const updatedCustomers = customers.map((c) => (c.id === updatedCust.id ? updatedCust : c));
    setCustomers(updatedCustomers);
    showToast('success', `Data customer [${updatedCust.code}] berhasil diperbarui.`);

    autoSyncMutationToSheets('CUSTOMER', {
      singleCust: updatedCust,
      newCustomers: updatedCustomers,
    });
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

        autoSyncMutationToSheets('CUSTOMER', {
          newCustomers: remainingCustomers,
        });
      },
    });
  };

  const handleSelectCustomerForTransaction = (cust: Customer) => {
    setTxModalType('OUT');
    setPreselectedRecipient(cust.name);
    setPreselectedItemId(undefined);
    setTransactionModalOpen(true);
  };

  // Supplier Database Handlers (Otomatis masuk ke sheet "DATABASE SUPPLIER")
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

    autoSyncMutationToSheets('SUPPLIER', {
      singleSupp: newSup,
      newSuppliers: updatedSuppliers,
    });
  };

  const handleUpdateSupplier = (updatedSup: Supplier) => {
    const updatedSuppliers = suppliers.map((s) => (s.id === updatedSup.id ? updatedSup : s));
    setSuppliers(updatedSuppliers);
    showToast('success', `Data supplier [${updatedSup.code}] berhasil diperbarui.`);

    autoSyncMutationToSheets('SUPPLIER', {
      singleSupp: updatedSup,
      newSuppliers: updatedSuppliers,
    });
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

        autoSyncMutationToSheets('SUPPLIER', {
          newSuppliers: remainingSuppliers,
        });
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
        activeUser={activeUser}
        spreadsheetConfig={spreadsheetConfig}
        isSyncing={isSyncing}
        onOpenSpreadsheetModal={() => setSpreadsheetModalOpen(true)}
        onOpenLoginModal={() => setLoginModalOpen(true)}
        onQuickSync={handleFullSync}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onLogoutAccount={handleLogoutAccount}
      />

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Target Google Spreadsheet Sync Banner (Only for server account) */}
          {activeUser?.username === 'server' && (
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
          )}

        {activeTab === 'dashboard' && (
          <DashboardView
            items={items}
            transactions={transactions}
            summary={summary}
            spreadsheetConfig={spreadsheetConfig}
            activeUser={activeUser}
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
            salesPersons={salesPersons}
            isFetching={isFetchingCustomers}
            onRefreshFromSheet={handleFetchCustomersFromSheet}
            onAddCustomer={handleAddCustomer}
            onUpdateCustomer={handleUpdateCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onSelectCustomerForTransaction={handleSelectCustomerForTransaction}
          />
        )}

        {activeTab === 'suppliers' && (
          <SuppliersView
            suppliers={suppliers}
            isFetching={isFetchingSuppliers}
            onRefreshFromSheet={handleFetchSuppliersFromSheet}
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
            isFetching={isFetchingTransactions}
            onRefreshFromSheets={handleFetchTransactionsFromSheet}
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

        {activeTab === 'accounts' && (
          <AccountsView
            accounts={accounts}
            activeUser={activeUser}
            onAddAccount={handleAddAccount}
            onUpdateAccount={handleUpdateAccount}
            onDeleteAccount={handleDeleteAccount}
            onRefreshFromSheet={handleFetchAccountsFromSheet}
            isSyncing={isSyncing || isFetchingAccounts}
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
        salesPersons={salesPersons}
        defaultType={txModalType}
        preselectedItemId={preselectedItemId}
        initialRecipient={preselectedRecipient}
        defaultOperator={activeUser?.name || user?.displayName || 'Petugas Gudang'}
        onSubmit={handleTransactionSubmit}
        onSubmitBatch={handleBatchTransactionSubmit}
      />

      {/* Login Account Modal (Sheet AKUN) */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        accounts={accounts}
        activeUser={activeUser}
        onLoginAccount={handleLoginAccount}
        onLoginGoogle={handleLogin}
        onRefreshAccountsFromSheet={handleFetchAccountsFromSheet}
        isSyncingAccounts={isFetchingAccounts}
        googleUserEmail={user?.email}
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
