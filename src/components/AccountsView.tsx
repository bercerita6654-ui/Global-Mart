import React, { useState } from 'react';
import {
  Users,
  ShieldCheck,
  Plus,
  RefreshCw,
  FileSpreadsheet,
  Search,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Download,
  X,
  Lock,
  Phone,
  Mail,
  UserCheck,
} from 'lucide-react';
import type { UserAccount, UserRole } from '../types/inventory.js';

interface AccountsViewProps {
  accounts: UserAccount[];
  salesPersons?: string[];
  activeUser: UserAccount | null;
  onAddAccount: (account: UserAccount) => void;
  onUpdateAccount: (account: UserAccount) => void;
  onDeleteAccount: (id: string) => void;
  onAddSalesPerson?: (name: string) => void;
  onDeleteSalesPerson?: (name: string) => void;
  onRefreshFromSheet?: () => Promise<void>;
  isSyncing?: boolean;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  accounts,
  salesPersons = [],
  activeUser,
  onAddAccount,
  onUpdateAccount,
  onDeleteAccount,
  onAddSalesPerson,
  onDeleteSalesPerson,
  onRefreshFromSheet,
  isSyncing = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [activeSubTab, setActiveSubTab] = useState<'accounts' | 'sales'>('accounts');
  const [newSalesName, setNewSalesName] = useState('');
  const [salesSearchTerm, setSalesSearchTerm] = useState('');

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<UserAccount | null>(null);

  const [formId, setFormId] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('Purchasing');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formStatus, setFormStatus] = useState<'Aktif' | 'Nonaktif'>('Aktif');
  const [formNotes, setFormNotes] = useState('');
  const [formAllowedMenus, setFormAllowedMenus] = useState<string[]>(['ALL']);

  const openAddModal = () => {
    const nextNum = accounts.length + 1;
    const nextId = `USR-${String(nextNum).padStart(3, '0')}`;
    setFormId(nextId);
    setFormUsername('');
    setFormPassword('');
    setFormName('');
    setFormRole('Purchasing');
    setFormEmail('');
    setFormPhone('');
    setFormStatus('Aktif');
    setFormNotes('');
    setFormAllowedMenus(['ALL']);
    setEditingAccount(null);
    setIsModalOpen(true);
  };

  const openEditModal = (acc: UserAccount) => {
    setFormId(acc.id);
    setFormUsername(acc.username);
    setFormPassword(acc.password || '');
    setFormName(acc.name);
    setFormRole(acc.role);
    setFormEmail(acc.email || '');
    setFormPhone(acc.phone || '');
    setFormStatus(acc.status);
    setFormNotes(acc.notes || '');
    setFormAllowedMenus(acc.allowedMenus && acc.allowedMenus.length > 0 ? acc.allowedMenus : ['ALL']);
    setEditingAccount(acc);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername.trim() || !formName.trim()) return;

    if (editingAccount) {
      onUpdateAccount({
        ...editingAccount,
        username: formUsername.trim().toLowerCase(),
        password: formPassword.trim() || editingAccount.password || '123',
        name: formName.trim(),
        role: formRole,
        allowedMenus: formAllowedMenus,
        email: formEmail.trim() || undefined,
        phone: formPhone.trim() || undefined,
        status: formStatus,
        notes: formNotes.trim() || undefined,
      });
    } else {
      onAddAccount({
        id: formId.trim() || `USR-${Date.now().toString().slice(-4)}`,
        username: formUsername.trim().toLowerCase(),
        password: formPassword.trim() || '123',
        name: formName.trim(),
        role: formRole,
        allowedMenus: formAllowedMenus,
        email: formEmail.trim() || undefined,
        phone: formPhone.trim() || undefined,
        status: formStatus,
        notes: formNotes.trim() || undefined,
      });
    }

    setIsModalOpen(false);
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPasswordMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredAccounts = accounts.filter((acc) => {
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      acc.id.toLowerCase().includes(q) ||
      acc.username.toLowerCase().includes(q) ||
      acc.name.toLowerCase().includes(q) ||
      (acc.email && acc.email.toLowerCase().includes(q)) ||
      (acc.phone && acc.phone.includes(q)) ||
      (acc.notes && acc.notes.toLowerCase().includes(q));

    const matchesRole =
      selectedRoleFilter === 'ALL' || acc.role === selectedRoleFilter;

    return matchesSearch && matchesRole;
  });

  const countAdmin = accounts.filter((a) => a.role === 'Admin').length;
  const countPurchasing = accounts.filter((a) => a.role === 'Purchasing').length;
  const countSuperUser = accounts.filter((a) => a.role === 'Super User').length;
  const countActive = accounts.filter((a) => a.status === 'Aktif').length;

  const roleBadgeStyle = (role: string) => {
    switch (role) {
      case 'Super User':
        return 'bg-purple-50 text-purple-800 border-purple-300';
      case 'Admin':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300';
      case 'Purchasing':
        return 'bg-blue-50 text-blue-800 border-blue-300';
      default:
        return 'bg-slate-50 text-slate-800 border-slate-300';
    }
  };

  const handleExportCsv = () => {
    const headers = ['ID Pengguna', 'Username', 'Password', 'Nama Lengkap', 'Role / Jabatan', 'Email', 'No. WhatsApp', 'Status', 'Terakhir Login', 'Catatan'];
    const rows = filteredAccounts.map((a) => [
      a.id,
      a.username,
      a.password || '-',
      `"${a.name.replace(/"/g, '""')}"`,
      a.role,
      a.email || '-',
      a.phone || '-',
      a.status,
      a.lastLogin || '-',
      `"${(a.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `database_akun_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Database Akun Pengguna
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
              {accounts.length} Akun
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Daftar kredensial user, hak akses (Admin, Gudang, Kasir, Supervisor, Sales) tersinkron dengan sheet &quot;AKUN&quot;.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Sheet &quot;AKUN&quot;</span>
          </div>

          {onRefreshFromSheet && (
            <button
              type="button"
              onClick={onRefreshFromSheet}
              disabled={isSyncing}
              className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:bg-slate-400"
              title="Tarik data akun terbaru dari Google Sheet 'AKUN'"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Mengambil...' : 'Tarik dari Sheet'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Ekspor CSV</span>
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className={`flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer ${
              activeSubTab === 'sales' ? 'hidden' : ''
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>+ Tambah Akun Baru</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs: Akun Pengguna vs Tim Sales */}
      <div className="flex items-center space-x-2 bg-slate-200/70 p-1.5 rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => setActiveSubTab('accounts')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'accounts'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Akun Pengguna (Sheet AKUN)</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-700 font-extrabold">
            {accounts.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('sales')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'sales'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4 text-indigo-600" />
          <span>Tim Sales (Sheet SALES)</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-indigo-50 text-indigo-700 font-extrabold">
            {salesPersons.length}
          </span>
        </button>
      </div>

      {activeSubTab === 'sales' ? (
        <div className="space-y-6">
          {/* Add Sales Form */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                <Users className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Tambah Tim Sales Baru</h2>
                <p className="text-xs text-slate-500">Nama sales akan otomatis tersinkron ke Sheet &quot;SALES&quot; di Google Sheets.</p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newSalesName.trim() || !onAddSalesPerson) return;
                onAddSalesPerson(newSalesName.trim());
                setNewSalesName('');
              }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
            >
              <input
                type="text"
                placeholder="Masukkan nama lengkap tim sales..."
                value={newSalesName}
                onChange={(e) => setNewSalesName(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Sales</span>
              </button>
            </form>
          </div>

          {/* Sales List Table */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <span className="p-2.5 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100">
                  <Users className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Daftar Tim Sales Aktif</h3>
                  <p className="text-xs text-slate-500">Total {salesPersons.length} sales terdaftar dalam sistem.</p>
                </div>
              </div>

              <div className="relative min-w-[240px] sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Cari nama sales..."
                  value={salesSearchTerm}
                  onChange={(e) => setSalesSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50/90 text-slate-700 font-bold uppercase tracking-wider text-[11px] sm:text-xs border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5 w-16">No</th>
                    <th className="px-6 py-3.5">Nama Tim Sales / Representative</th>
                    <th className="px-6 py-3.5 text-center w-32">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salesPersons.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-12 text-slate-500">
                        <Users className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                        <p className="font-bold text-slate-700 text-sm">Belum ada data tim sales</p>
                      </td>
                    </tr>
                  ) : (
                    salesPersons
                      .filter((s) => !salesSearchTerm || s.toLowerCase().includes(salesSearchTerm.toLowerCase()))
                      .map((sales, idx) => (
                        <tr key={`${sales}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-6 py-3.5 font-bold text-slate-500">{idx + 1}</td>
                          <td className="px-6 py-3.5 font-bold text-slate-900 flex items-center space-x-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                            <span>{sales}</span>
                          </td>
                          <td className="px-6 py-3.5 text-center">
                            {onDeleteSalesPerson && (
                              <button
                                type="button"
                                onClick={() => onDeleteSalesPerson(sales)}
                                title={`Hapus sales ${sales}`}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer inline-flex items-center space-x-1 text-xs font-bold"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Hapus</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total User</span>
          <p className="text-xl font-black text-slate-900 mt-1">{accounts.length}</p>
          <span className="text-[10px] text-emerald-600 font-bold">{countActive} Akun Aktif</span>
        </div>

        <div className="p-3.5 bg-white border border-emerald-200 rounded-2xl shadow-xs">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Admin</span>
          <p className="text-xl font-black text-emerald-900 mt-1">{countAdmin}</p>
          <span className="text-[10px] text-slate-500">Administrator Utama</span>
        </div>

        <div className="p-3.5 bg-white border border-blue-200 rounded-2xl shadow-xs">
          <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">Purchasing</span>
          <p className="text-xl font-black text-blue-900 mt-1">{countPurchasing}</p>
          <span className="text-[10px] text-slate-500">Purchasing & Staff</span>
        </div>

        <div className="p-3.5 bg-white border border-purple-200 rounded-2xl shadow-xs">
          <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider block">Super User</span>
          <p className="text-xl font-black text-purple-900 mt-1">{countSuperUser}</p>
          <span className="text-[10px] text-slate-500">Akses Penuh Server</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Cari akun berdasarkan nama, username, email, WhatsApp..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Role Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => setSelectedRoleFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl border transition-all ${
              selectedRoleFilter === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Semua Role ({accounts.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedRoleFilter('Admin')}
            className={`px-3 py-1.5 rounded-xl border transition-all ${
              selectedRoleFilter === 'Admin'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            Admin ({countAdmin})
          </button>
          <button
            type="button"
            onClick={() => setSelectedRoleFilter('Purchasing')}
            className={`px-3 py-1.5 rounded-xl border transition-all ${
              selectedRoleFilter === 'Purchasing'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
            }`}
          >
            Purchasing ({countPurchasing})
          </button>
          <button
            type="button"
            onClick={() => setSelectedRoleFilter('Super User')}
            className={`px-3 py-1.5 rounded-xl border transition-all ${
              selectedRoleFilter === 'Super User'
                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                : 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'
            }`}
          >
            Super User ({countSuperUser})
          </button>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5">ID & Username</th>
                <th className="px-4 py-3.5">Nama Lengkap</th>
                <th className="px-4 py-3.5 text-center">Role / Jabatan</th>
                <th className="px-4 py-3.5 text-center">Kata Sandi</th>
                <th className="px-4 py-3.5">Kontak & Email</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5">Login Terakhir</th>
                <th className="px-4 py-3.5">Catatan</th>
                <th className="px-4 py-3.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-500">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700">Tidak ada akun yang sesuai pencarian</p>
                    <p className="text-xs">Ubah filter role atau tambahkan akun pengguna baru.</p>
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc, idx) => {
                  const isViewingPassword = !!showPasswordMap[acc.id];
                  const isCurrentActive = activeUser?.id === acc.id || activeUser?.username === acc.username;

                  return (
                    <tr key={`${acc.id}-${idx}`} className={`hover:bg-slate-50 transition-colors ${isCurrentActive ? 'bg-emerald-50/40' : ''}`}>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-500 text-[11px] block">{acc.id}</span>
                        <div className="flex items-center space-x-1.5 mt-0.5">
                          <span className="font-extrabold text-slate-900 font-mono">@{acc.username}</span>
                          {isCurrentActive && (
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded">
                              Aktif Login
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="font-bold text-slate-900 text-sm block">{acc.name}</span>
                      </td>

                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-extrabold border ${roleBadgeStyle(acc.role)}`}>
                          {acc.role}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                          <span className="font-mono text-xs font-bold text-slate-800">
                            {isViewingPassword ? (acc.password || '-') : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(acc.id)}
                            className="text-slate-500 hover:text-slate-800 p-0.5"
                            title={isViewingPassword ? 'Sembunyikan' : 'Lihat password'}
                          >
                            {isViewingPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {acc.phone && (
                          <div className="flex items-center space-x-1 text-slate-700">
                            <Phone className="w-3 h-3 text-emerald-600" />
                            <span className="font-mono text-xs">{acc.phone}</span>
                          </div>
                        )}
                        {acc.email && (
                          <div className="flex items-center space-x-1 text-slate-500 text-[11px] mt-0.5">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>{acc.email}</span>
                          </div>
                        )}
                        {!acc.phone && !acc.email && <span className="text-slate-400">-</span>}
                      </td>

                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            acc.status === 'Aktif'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {acc.status === 'Aktif' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Aktif</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>Nonaktif</span>
                            </>
                          )}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap font-mono text-[11px] text-slate-600">
                        {acc.lastLogin || '-'}
                      </td>

                      <td className="px-4 py-3.5 max-w-[180px] truncate text-slate-600 text-xs" title={acc.notes}>
                        {acc.notes || '-'}
                      </td>

                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(acc)}
                            className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Edit akun"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Hapus akun "${acc.name}" (@${acc.username})?`)) {
                                onDeleteAccount(acc.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                            title="Hapus akun"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 bg-gradient-to-r from-slate-900 to-emerald-950 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    {editingAccount ? 'Edit Akun Pengguna' : 'Tambah Akun Pengguna Baru'}
                  </h3>
                  <p className="text-xs text-emerald-200">
                    Otomatis tersimpan ke sheet &quot;AKUN&quot; di Google Spreadsheet
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    ID Pengguna <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Username Login <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="cth: kasir1, admin"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Nama Lengkap <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="cth: Budi Santoso"
                  value={formName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormName(val);
                    if (!editingAccount) {
                      const slug = val.trim().toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '');
                      setFormId(slug ? `USR-${slug}` : 'USR-NEW');
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Kata Sandi / Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="cth: rahasia123"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Role / Hak Akses <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Purchasing">Purchasing</option>
                    <option value="Super User">Super User</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    No. WhatsApp / HP
                  </label>
                  <input
                    type="text"
                    placeholder="cth: 081234567890"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Email Kontak
                  </label>
                  <input
                    type="email"
                    placeholder="cth: user@globalmart.id"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Otoritas Akses Menu & Aksi (Lihat, Tambah, Ubah, Hapus)
                </label>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <label className="flex items-center space-x-2 text-xs font-extrabold text-emerald-800 pb-2 border-b border-slate-200">
                    <input
                      type="checkbox"
                      checked={formAllowedMenus.includes('ALL')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormAllowedMenus(['ALL']);
                        } else {
                          setFormAllowedMenus(['dashboard', 'master', 'customers', 'suppliers', 'history', 'reports']);
                        }
                      }}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span>Full Akses (Semua Menu & Aksi)</span>
                  </label>

                  {!formAllowedMenus.includes('ALL') && (
                    <div className="space-y-2 pt-1">
                      {[
                        { id: 'dashboard', label: 'Dashboard', actions: [{ key: 'view', label: 'Lihat' }] },
                        { id: 'master', label: 'Stock List / Master', actions: [{ key: 'view', label: 'Lihat' }, { key: 'add', label: 'Tambah' }, { key: 'edit', label: 'Ubah' }, { key: 'delete', label: 'Hapus' }] },
                        { id: 'customers', label: 'Database Customer', actions: [{ key: 'view', label: 'Lihat' }, { key: 'add', label: 'Tambah' }, { key: 'edit', label: 'Ubah' }, { key: 'delete', label: 'Hapus' }] },
                        { id: 'suppliers', label: 'Database Supplier', actions: [{ key: 'view', label: 'Lihat' }, { key: 'add', label: 'Tambah' }, { key: 'edit', label: 'Ubah' }, { key: 'delete', label: 'Hapus' }] },
                        { id: 'history_in', label: 'History Pembelian (Masuk)', actions: [{ key: 'view', label: 'Lihat' }, { key: 'add', label: 'Tambah' }, { key: 'edit', label: 'Ubah' }, { key: 'delete', label: 'Hapus' }] },
                        { id: 'history_out', label: 'History Penjualan (Keluar)', actions: [{ key: 'view', label: 'Lihat' }, { key: 'add', label: 'Tambah' }, { key: 'edit', label: 'Ubah' }, { key: 'delete', label: 'Hapus' }] },
                        { id: 'reports', label: 'Laporan', actions: [{ key: 'view', label: 'Lihat' }] },
                        { id: 'accounts', label: 'Database Akun', actions: [{ key: 'view', label: 'Lihat' }, { key: 'edit', label: 'Kelola' }] },
                      ].map((m) => {
                        return (
                          <div key={m.id} className="p-2.5 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900 w-36">{m.label}</span>
                            <div className="flex flex-wrap items-center gap-3">
                              {m.actions.map((act) => {
                                const specificToken = `${m.id}:${act.key}`;
                                const isChecked =
                                  formAllowedMenus.includes('ALL') ||
                                  formAllowedMenus.includes(specificToken) ||
                                  (act.key === 'view' && formAllowedMenus.includes(m.id));

                                return (
                                  <label key={act.key} className="flex items-center space-x-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        const check = e.target.checked;
                                        let updatedTokens: string[] = [];

                                        if (formAllowedMenus.includes('ALL')) {
                                          [
                                            { id: 'dashboard', actions: ['view'] },
                                            { id: 'master', actions: ['view', 'add', 'edit', 'delete'] },
                                            { id: 'customers', actions: ['view', 'add', 'edit', 'delete'] },
                                            { id: 'suppliers', actions: ['view', 'add', 'edit', 'delete'] },
                                            { id: 'history_in', actions: ['view', 'add', 'edit', 'delete'] },
                                            { id: 'history_out', actions: ['view', 'add', 'edit', 'delete'] },
                                            { id: 'reports', actions: ['view'] },
                                            { id: 'accounts', actions: ['view', 'edit'] },
                                          ].forEach((mod) => {
                                            mod.actions.forEach((aKey) => {
                                              updatedTokens.push(`${mod.id}:${aKey}`);
                                            });
                                          });
                                        } else {
                                          formAllowedMenus.forEach((t) => {
                                            if (!t.includes(':') && t !== 'ALL') {
                                              if (t === 'master') updatedTokens.push('master:view', 'master:add', 'master:edit', 'master:delete');
                                              else if (t === 'customers') updatedTokens.push('customers:view', 'customers:add', 'customers:edit', 'customers:delete');
                                              else if (t === 'suppliers') updatedTokens.push('suppliers:view', 'suppliers:add', 'suppliers:edit', 'suppliers:delete');
                                              else if (t === 'history') updatedTokens.push('history_in:view', 'history_in:add', 'history_in:edit', 'history_in:delete', 'history_out:view', 'history_out:add', 'history_out:edit', 'history_out:delete');
                                              else if (t === 'reports') updatedTokens.push('reports:view');
                                              else if (t === 'accounts') updatedTokens.push('accounts:view', 'accounts:edit');
                                              else updatedTokens.push(`${t}:view`);
                                            } else {
                                              if (!updatedTokens.includes(t)) updatedTokens.push(t);
                                            }
                                          });
                                        }

                                        if (check) {
                                          if (!updatedTokens.includes(specificToken)) {
                                            updatedTokens.push(specificToken);
                                          }
                                        } else {
                                          updatedTokens = updatedTokens.filter((t) => t !== specificToken && t !== m.id);
                                        }

                                        setFormAllowedMenus(updatedTokens.length > 0 ? updatedTokens : ['dashboard:view']);
                                      }}
                                      className="w-3.5 h-3.5 text-emerald-600 rounded focus:ring-emerald-500"
                                    />
                                    <span>{act.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Catatan Tambahan
                </label>
                <textarea
                  rows={2}
                  placeholder="Keterangan tugas, divisi, atau wewenang..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center space-x-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Data akun akan otomatis tercatat ke sheet &quot;AKUN&quot;.</span>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-colors"
                >
                  {editingAccount ? 'Simpan Perubahan' : 'Tambah Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
