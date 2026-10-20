import React, { useState } from 'react';
import {
  FileSpreadsheet,
  X,
  ExternalLink,
  RefreshCw,
  PlusCircle,
  Link2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Database,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { SpreadsheetConfig, Item, Transaction } from '../types/inventory.js';

interface SpreadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  spreadsheetConfig: SpreadsheetConfig | null;
  items: Item[];
  transactions: Transaction[];
  isSyncing: boolean;
  onLogin: () => void;
  onCreateNewSheet: (title: string) => Promise<void>;
  onConnectExistingSheet: (id: string) => Promise<boolean>;
  onTriggerFullSync: () => Promise<void>;
  onToggleAutoSync: (enabled: boolean) => void;
}

export const SpreadsheetModal: React.FC<SpreadsheetModalProps> = ({
  isOpen,
  onClose,
  user,
  spreadsheetConfig,
  items,
  transactions,
  isSyncing,
  onLogin,
  onCreateNewSheet,
  onConnectExistingSheet,
  onTriggerFullSync,
  onToggleAutoSync,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'create' | 'existing'>('create');
  const [sheetTitle, setSheetTitle] = useState(
    `StockFlow - Inventory Gudang (${new Date().toLocaleDateString('id-ID')})`
  );
  const [existingInput, setExistingInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  if (!isOpen) return null;

  const handleCreate = async () => {
    setActionError('');
    setActionSuccess('');
    setIsProcessing(true);
    try {
      await onCreateNewSheet(sheetTitle.trim());
      setActionSuccess('Spreadsheet Google Sheets baru berhasil dibuat dan ditautkan!');
    } catch (err: any) {
      setActionError(err.message || 'Gagal membuat spreadsheet.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConnect = async () => {
    setActionError('');
    setActionSuccess('');

    let sheetId = existingInput.trim();
    // Support full URL pasting: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
    if (sheetId.includes('/d/')) {
      const match = sheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        sheetId = match[1];
      }
    }

    if (!sheetId) {
      setActionError('Masukkan ID Spreadsheet atau link URL Google Sheets yang valid.');
      return;
    }

    setIsProcessing(true);
    try {
      const ok = await onConnectExistingSheet(sheetId);
      if (ok) {
        setActionSuccess('Berhasil terhubung ke spreadsheet Google Sheets!');
        setExistingInput('');
      } else {
        setActionError('Gagal mengakses spreadsheet. Pastikan akun Google Anda memiliki akses edit.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Gagal menyambungkan spreadsheet.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-sheets-title"
        className="bg-white rounded-3xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden my-8 animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-500/20 border border-emerald-400/30 rounded-xl text-emerald-300">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 id="modal-sheets-title" className="text-lg font-bold">Integrasi Google Sheets API</h3>
              <p className="text-xs text-emerald-200/80">
                Sinkronisasi data master & riwayat transaksi real-time
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup pengaturan spreadsheet"
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs sm:text-sm">
          {/* Notifications */}
          {actionError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-start space-x-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{actionError}</span>
            </div>
          )}
          {actionSuccess && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 flex items-start space-x-2 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* User Status Check */}
          {!user ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 space-y-3">
              <div className="flex items-center space-x-2 font-bold text-xs">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Akun Google Belum Terhubung</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                Untuk menyinkronkan data langsung ke spreadsheet Google Drive Anda, masuk dengan akun Google terlebih dahulu:
              </p>
              <button
                onClick={onLogin}
                className="w-full py-2.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 flex items-center justify-center space-x-2 shadow-xs transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Masuk dengan Google untuk Akses Sheets</span>
              </button>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-slate-600">Login sebagai:</span>
                <strong className="text-slate-900">{user.email}</strong>
              </div>
            </div>
          )}

          {/* Currently Connected Sheet Status */}
          {spreadsheetConfig?.spreadsheetId && (
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-emerald-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="font-bold text-sm">Spreadsheet Aktif Terhubung</span>
                </div>
                <a
                  href={spreadsheetConfig.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-white px-3 py-1 rounded-lg border border-emerald-300"
                >
                  <span>Buka di Google Sheets</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="text-xs text-slate-700 space-y-1 bg-white/70 p-3 rounded-xl border border-emerald-100">
                <p>
                  <strong>Judul:</strong> {spreadsheetConfig.spreadsheetTitle}
                </p>
                <p className="font-mono text-[11px] truncate">
                  <strong>ID:</strong> {spreadsheetConfig.spreadsheetId}
                </p>
                <p>
                  <strong>Terakhir Sinkronisasi:</strong>{' '}
                  {spreadsheetConfig.lastSyncedAt || 'Belum pernah'}
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center space-x-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={spreadsheetConfig.autoSync}
                    onChange={(e) => onToggleAutoSync(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Sinkronisasi Otomatis Setiap Transaksi Baru</span>
                </label>

                <button
                  type="button"
                  onClick={onTriggerFullSync}
                  disabled={isSyncing}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors disabled:bg-slate-300"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Subtabs for Setup */}
          <div className="border-t border-slate-200 pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
              {spreadsheetConfig?.spreadsheetId ? 'Ganti atau Buat Spreadsheet Lain' : 'Pilihan Pengaturan Database'}
            </h4>

            <div className="flex p-1 bg-slate-100 rounded-xl mb-4 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setActiveSubTab('create');
                  setActionError('');
                  setActionSuccess('');
                }}
                className={`flex-1 py-2 rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
                  activeSubTab === 'create'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>Buat Baru Otomatis (Rekomendasi)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveSubTab('existing');
                  setActionError('');
                  setActionSuccess('');
                }}
                className={`flex-1 py-2 rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
                  activeSubTab === 'existing'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Link2 className="w-4 h-4" />
                <span>Tautkan Spreadsheet ID</span>
              </button>
            </div>

            {activeSubTab === 'create' ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Sistem akan membuat Google Spreadsheet baru di Google Drive Anda dengan lembar kerja:
                  <br />
                  1. <strong className="text-slate-800">DATA_BARANG</strong> (Master data produk, harga modal &amp; bertingkat, stok 3 gudang)
                  <br />
                  2. <strong className="text-slate-800">MUTASI_TRANSAKSI</strong> (Log masuk/keluar lengkap)
                  <br />
                  3. <strong className="text-slate-800">DATA_PELANGGAN</strong> (Database customer/toko)
                  <br />
                  4. <strong className="text-slate-800">DATA_PEMASOK</strong> (Database supplier)
                  <br />
                  5. <strong className="text-slate-800">RINGKASAN_GUDANG</strong> (KPI stok &amp; nilai aset modal)
                </p>
                <div>
                  <label htmlFor="sheet-name" className="block text-xs font-bold text-slate-700 mb-1">
                    Nama File Spreadsheet
                  </label>
                  <input
                    id="sheet-name"
                    type="text"
                    value={sheetTitle}
                    onChange={(e) => setSheetTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isProcessing || !user}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {isProcessing ? 'Sedang Membuat Spreadsheet...' : 'Buat Spreadsheet Baru di Google Drive'}
                  </span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Punya Google Sheets yang sudah ada? Masukkan URL atau ID Spreadsheet (dari URL bar browser Anda).
                </p>
                <div>
                  <label htmlFor="sheet-url" className="block text-xs font-bold text-slate-700 mb-1">
                    ID atau URL Google Sheets
                  </label>
                  <input
                    id="sheet-url"
                    type="text"
                    placeholder="https://docs.google.com/spreadsheets/d/1olil_je3rWoIn3SdZSO6kHIHGNxbUOtl7BphNTjxeRs/edit?gid=0#gid=0"
                    value={existingInput}
                    onChange={(e) => setExistingInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:bg-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={isProcessing || !user || !existingInput.trim()}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  <Link2 className="w-4 h-4" />
                  <span>{isProcessing ? 'Memeriksa Akses...' : 'Hubungkan ke Spreadsheet Ini'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
