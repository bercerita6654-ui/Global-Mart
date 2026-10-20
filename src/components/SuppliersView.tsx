import React, { useState } from 'react';
import {
  Search,
  Plus,
  Truck,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Building,
  User,
  X,
  Check,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Supplier } from '../types/inventory.js';

interface SuppliersViewProps {
  suppliers: Supplier[];
  isFetching?: boolean;
  onRefreshFromSheet?: () => void;
  onAddSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt' | 'lastUpdated'>) => void;
  onUpdateSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (supplierId: string) => void;
  onSelectSupplierForTransaction?: (supplier: Supplier) => void;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  suppliers,
  isFetching = false,
  onRefreshFromSheet,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  onSelectSupplierForTransaction,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Form state
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formContactPerson, setFormContactPerson] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');

  const openAddModal = () => {
    setEditingSupplier(null);
    const nextNum = suppliers.length + 1;
    setFormCode(`SUP-${String(nextNum).padStart(3, '0')}`);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormCity('Jakarta');
    setFormContactPerson('');
    setFormNotes('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormCode(supplier.code);
    setFormName(supplier.name);
    setFormPhone(supplier.phone);
    setFormEmail(supplier.email || '');
    setFormAddress(supplier.address);
    setFormCity(supplier.city || '');
    setFormContactPerson(supplier.contactPerson || '');
    setFormNotes(supplier.notes || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formCode.trim()) {
      setFormError('Kode Supplier wajib diisi.');
      return;
    }
    if (!formName.trim()) {
      setFormError('Nama Supplier / Vendor wajib diisi.');
      return;
    }
    if (!formPhone.trim()) {
      setFormError('Nomor telepon / WhatsApp wajib diisi.');
      return;
    }
    if (!formAddress.trim()) {
      setFormError('Alamat supplier wajib diisi.');
      return;
    }

    if (editingSupplier) {
      onUpdateSupplier({
        ...editingSupplier,
        code: formCode.trim().toUpperCase(),
        name: formName.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim() || undefined,
        address: formAddress.trim(),
        city: formCity.trim() || undefined,
        contactPerson: formContactPerson.trim() || undefined,
        notes: formNotes.trim() || undefined,
        lastUpdated: new Date().toISOString(),
      });
    } else {
      onAddSupplier({
        code: formCode.trim().toUpperCase(),
        name: formName.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim() || undefined,
        address: formAddress.trim(),
        city: formCity.trim() || undefined,
        contactPerson: formContactPerson.trim() || undefined,
        notes: formNotes.trim() || undefined,
      });
    }

    setIsModalOpen(false);
  };

  const filtered = suppliers.filter((s) => {
    const q = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      s.phone.toLowerCase().includes(q) ||
      (s.contactPerson && s.contactPerson.toLowerCase().includes(q)) ||
      (s.city && s.city.toLowerCase().includes(q)) ||
      (s.address && s.address.toLowerCase().includes(q))
    );
  });

  const handleExportExcel = () => {
    const dataToExport = filtered.map((s, idx) => ({
      No: idx + 1,
      'Kode Supplier': s.code,
      'Nama Supplier / Vendor': s.name,
      'No. Telepon / WA': s.phone,
      'Kontak PIC': s.contactPerson || '-',
      Email: s.email || '-',
      Kota: s.city || '-',
      Alamat: s.address,
      Catatan: s.notes || '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Database Supplier');
    XLSX.writeFile(workbook, `database_supplier_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <Truck className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Database Supplier</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Daftar distributor, pabrik, dan vendor rekanan untuk penginputan nama supplier pada penerimaan barang (History Pembelian).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-50 text-indigo-800 text-xs font-bold rounded-xl border border-indigo-200">
            <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
            <span>Sheet &quot;DATABASE SUPPLIER&quot;</span>
          </div>

          {onRefreshFromSheet && (
            <button
              onClick={onRefreshFromSheet}
              disabled={isFetching}
              className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:bg-slate-400"
              title="Tarik data supplier terbaru dari Google Sheet 'DATABASE SUPPLIER'"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span>{isFetching ? 'Mengambil...' : 'Tarik dari Sheet'}</span>
            </button>
          )}

          <button
            onClick={handleExportExcel}
            className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export to Excel</span>
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ Tambah Supplier Baru</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari kode supplier, nama vendor, kontak PIC, atau kota..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <span className="text-xs font-bold text-slate-500 shrink-0">
          Total: {filtered.length} Supplier
        </span>
      </div>

      {/* Supplier Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5">Kode</th>
                <th className="px-4 py-3.5">Nama Supplier / Vendor</th>
                <th className="px-4 py-3.5">Kontak & PIC</th>
                <th className="px-4 py-3.5">Wilayah & Alamat</th>
                <th className="px-4 py-3.5">Catatan Khusus</th>
                <th className="px-4 py-3.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    <Truck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">Tidak ada supplier yang ditemukan</p>
                    <p className="text-xs">Klik tombol '+ Tambah Supplier Baru' untuk memasukkan data rekanan.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-indigo-700 whitespace-nowrap">
                      {s.code}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900 text-sm">{s.name}</p>
                      {s.email && <p className="text-[11px] text-slate-500">{s.email}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-slate-800 flex items-center space-x-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{s.contactPerson || '-'}</span>
                        </p>
                        <p className="text-slate-600 flex items-center space-x-1 font-mono">
                          <Phone className="w-3 h-3 text-emerald-600" />
                          <span>{s.phone}</span>
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      {s.city && (
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 mb-1">
                          {s.city}
                        </span>
                      )}
                      <p className="text-slate-600 text-[11px] line-clamp-2">{s.address}</p>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-slate-600 text-[11px] italic">
                        {s.notes || '-'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center space-x-1.5">
                        {onSelectSupplierForTransaction && (
                          <button
                            type="button"
                            onClick={() => onSelectSupplierForTransaction(s)}
                            title={`Input Barang Masuk dari ${s.name}`}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition-colors flex items-center space-x-1 text-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Input Masuk</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditModal(s)}
                          title="Edit Data Supplier"
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSupplier(s.id)}
                          title="Hapus Supplier"
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add / Edit Supplier */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Truck className="w-5 h-5 text-indigo-400" />
                <h3 className="font-extrabold text-base">
                  {editingSupplier ? 'Edit Data Supplier' : 'Tambah Supplier Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kode Supplier <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="SUP-001"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kota / Wilayah
                  </label>
                  <input
                    type="text"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    placeholder="Cth: Jakarta Pusat"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Supplier / Perusahaan Vendor <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Cth: PT Belden Network Solusindo"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    No. Telepon / WhatsApp <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="08123456789 / 021-..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kontak PIC / Sales
                  </label>
                  <input
                    type="text"
                    value={formContactPerson}
                    onChange={(e) => setFormContactPerson(e.target.value)}
                    placeholder="Cth: Pak Budi"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="sales@vendor.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat Kantor / Gudang Supplier <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Jl. Raya Distribusi No..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Tambahan
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Cth: Termin pembayaran 30 hari, supplier resmi kabel LAN..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20"
                >
                  {editingSupplier ? 'Simpan Perubahan' : 'Simpan Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
