import React, { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Building,
  Edit2,
  Trash2,
  ArrowUpRight,
  Download,
  X,
  MessageCircle,
  FileText,
  Tag,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';
import type { Customer, CustomerType, PaymentMethod, CreditTerm } from '../types/inventory.js';
import { SALES_PERSONS } from '../types/inventory.js';

interface CustomersViewProps {
  customers: Customer[];
  salesPersons?: string[];
  isFetching?: boolean;
  onRefreshFromSheet?: () => void;
  onAddCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'lastUpdated'>) => void;
  onUpdateCustomer: (customer: Customer) => void;
  onDeleteCustomer: (customerId: string) => void;
  onSelectCustomerForTransaction?: (customer: Customer) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  salesPersons,
  isFetching = false,
  onRefreshFromSheet,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onSelectCustomerForTransaction,
}) => {
  const activeSalesList = salesPersons && salesPersons.length > 0 ? salesPersons : [...SALES_PERSONS];
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'ALL' | CustomerType>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Form Fields
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formType, setFormType] = useState<CustomerType>('Grosir');
  const [formPaymentMethod, setFormPaymentMethod] = useState<PaymentMethod>('CASH');
  const [formCreditTerm, setFormCreditTerm] = useState<CreditTerm>('14 Hari');
  const [formSalesPerson, setFormSalesPerson] = useState<string>(activeSalesList[0] || 'Sales');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Filter Customers
  const filteredCustomers = customers.filter((cust) => {
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      cust.code.toLowerCase().includes(q) ||
      cust.name.toLowerCase().includes(q) ||
      cust.phone.toLowerCase().includes(q) ||
      (cust.email || '').toLowerCase().includes(q) ||
      cust.address.toLowerCase().includes(q) ||
      (cust.city || '').toLowerCase().includes(q) ||
      (cust.paymentMethod || '').toLowerCase().includes(q) ||
      (cust.creditTerm || '').toLowerCase().includes(q) ||
      (cust.salesPerson || '').toLowerCase().includes(q) ||
      (cust.notes || '').toLowerCase().includes(q);

    const matchesType = selectedType === 'ALL' || cust.type === selectedType;
    return matchesSearch && matchesType;
  });

  // Metric counts
  const totalCount = customers.length;
  const eceranCount = customers.filter((c) => c.type === 'Eceran').length;
  const grosirCount = customers.filter((c) => c.type === 'Grosir').length;
  const partaiCount = customers.filter((c) => c.type === 'Partai').length;

  const openAddModal = () => {
    setEditingCustomer(null);
    // Auto generate next code
    const nextNum = customers.length + 1;
    setFormCode(`CST-${String(nextNum).padStart(3, '0')}`);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormCity('');
    setFormType('Grosir');
    setFormPaymentMethod('CASH');
    setFormCreditTerm('14 Hari');
    setFormSalesPerson(activeSalesList[0] || 'Sales');
    setFormNotes('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setFormCode(cust.code);
    setFormName(cust.name);
    setFormPhone(cust.phone);
    setFormEmail(cust.email || '');
    setFormAddress(cust.address);
    setFormCity(cust.city || '');
    setFormType(cust.type);
    setFormPaymentMethod(cust.paymentMethod || 'CASH');
    setFormCreditTerm(cust.creditTerm || '14 Hari');
    setFormSalesPerson(cust.salesPerson || activeSalesList[0] || 'Sales');
    setFormNotes(cust.notes || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formCode.trim()) {
      setFormError('Kode customer tidak boleh kosong.');
      return;
    }
    if (!formName.trim()) {
      setFormError('Nama pelanggan atau toko tidak boleh kosong.');
      return;
    }
    if (!formPhone.trim()) {
      setFormError('Nomor telepon / WhatsApp tidak boleh kosong.');
      return;
    }

    if (editingCustomer) {
      onUpdateCustomer({
        ...editingCustomer,
        code: formCode.trim(),
        name: formName.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim() || undefined,
        address: formAddress.trim(),
        city: formCity.trim() || undefined,
        type: formType,
        paymentMethod: formPaymentMethod,
        creditTerm: formPaymentMethod === 'KREDIT' ? formCreditTerm : undefined,
        salesPerson: formSalesPerson,
        notes: formNotes.trim() || undefined,
        lastUpdated: new Date().toISOString(),
      });
    } else {
      onAddCustomer({
        code: formCode.trim(),
        name: formName.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim() || undefined,
        address: formAddress.trim(),
        city: formCity.trim() || undefined,
        type: formType,
        paymentMethod: formPaymentMethod,
        creditTerm: formPaymentMethod === 'KREDIT' ? formCreditTerm : undefined,
        salesPerson: formSalesPerson,
        notes: formNotes.trim() || undefined,
      });
    }

    setIsModalOpen(false);
  };

  const handleExportCsv = () => {
    const headers = ['Kode Customer', 'Nama Pelanggan/Toko', 'Tipe/Kategori', 'Pembayaran', 'Termin Kredit', 'Sales Penanggung Jawab', 'No. WhatsApp', 'Email', 'Kota', 'Alamat', 'Catatan'];
    const rows = filteredCustomers.map((c) => [
      c.code,
      `"${c.name.replace(/"/g, '""')}"`,
      c.type,
      c.paymentMethod || 'CASH',
      c.paymentMethod === 'KREDIT' ? (c.creditTerm || '14 Hari') : '-',
      `"${(c.salesPerson || '-').replace(/"/g, '""')}"`,
      c.phone,
      c.email || '',
      `"${(c.city || '').replace(/"/g, '""')}"`,
      `"${c.address.replace(/"/g, '""')}"`,
      `"${(c.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `database_customer_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getWaLink = (phone: string, name: string) => {
    // Format to 62...
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    }
    const text = encodeURIComponent(`Halo ${name}, kami dari StockFlow Management...`);
    return `https://wa.me/${clean}?text=${text}`;
  };

  return (
    <div className="space-y-6">
      {/* Header and Top Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Database Customer</h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
              {totalCount} Pelanggan
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Daftar lengkap mitra & pelanggan dengan klasifikasi harga (Eceran, Grosir, Partai) serta riwayat transaksi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Sheet &quot;DATABASE CUSTOMER&quot;</span>
          </div>

          {onRefreshFromSheet && (
            <button
              onClick={onRefreshFromSheet}
              disabled={isFetching}
              className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:bg-slate-400"
              title="Tarik data customer terbaru dari Google Sheet 'DATABASE CUSTOMER'"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span>{isFetching ? 'Mengambil...' : 'Tarik dari Sheet'}</span>
            </button>
          )}

          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Ekspor CSV</span>
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-emerald-600/20 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Customer Baru</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
          <div className="p-3 rounded-xl bg-slate-100 text-slate-700">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-600 font-medium">Total Pelanggan</p>
            <p className="text-xl font-extrabold text-slate-900">{totalCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
          <div className="p-3 rounded-xl bg-emerald-100 text-emerald-700">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-600 font-medium">Customer Eceran</p>
            <p className="text-xl font-extrabold text-emerald-700">{eceranCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
          <div className="p-3 rounded-xl bg-indigo-100 text-indigo-700">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-600 font-medium">Customer Grosir</p>
            <p className="text-xl font-extrabold text-indigo-700">{grosirCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
          <div className="p-3 rounded-xl bg-amber-100 text-amber-700">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-600 font-medium">Customer Partai</p>
            <p className="text-xl font-extrabold text-amber-700">{partaiCount}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama, kode, nomor HP/WA, kota, atau alamat..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Customer Type Filter Pills */}
        <div className="flex p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600 shrink-0">
          <button
            onClick={() => setSelectedType('ALL')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              selectedType === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Semua ({totalCount})
          </button>
          <button
            onClick={() => setSelectedType('Eceran')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              selectedType === 'Eceran' ? 'bg-white text-emerald-700 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Eceran ({eceranCount})
          </button>
          <button
            onClick={() => setSelectedType('Grosir')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              selectedType === 'Grosir' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Grosir ({grosirCount})
          </button>
          <button
            onClick={() => setSelectedType('Partai')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              selectedType === 'Partai' ? 'bg-white text-amber-700 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Partai ({partaiCount})
          </button>
        </div>
      </div>

      {/* Customer Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5">Kode & Nama Customer</th>
                <th className="px-4 py-3.5 text-center">Kategori Tier</th>
                <th className="px-4 py-3.5 text-center">Pembayaran & Termin</th>
                <th className="px-4 py-3.5">Sales Penanggung Jawab</th>
                <th className="px-4 py-3.5">Kontak & WhatsApp</th>
                <th className="px-4 py-3.5">Kota / Wilayah</th>
                <th className="px-4 py-3.5">Alamat Lengkap</th>
                <th className="px-4 py-3.5">Catatan Khusus</th>
                <th className="px-4 py-3.5 text-center">Aksi Cepat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-600">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">Tidak ada data customer yang cocok</p>
                    <p className="text-xs">Ubah kata kunci pencarian atau tambahkan customer baru.</p>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => {
                  return (
                    <tr key={cust.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5">
                        <span className="font-mono font-bold text-slate-600 block text-[11px]">{cust.code}</span>
                        <p className="font-bold text-slate-900 text-sm">{cust.name}</p>
                        {cust.email && (
                          <div className="flex items-center space-x-1 text-[11px] text-slate-600 mt-0.5">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>{cust.email}</span>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold border ${
                            cust.type === 'Eceran'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : cust.type === 'Grosir'
                              ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {cust.type}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {cust.paymentMethod === 'KREDIT' ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
                              KREDIT
                            </span>
                            <span className="text-[10px] text-purple-700 font-bold mt-0.5">
                              Termin {cust.creditTerm || '14 Hari'}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            CASH
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {cust.salesPerson ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            <span>👤 {cust.salesPerson}</span>
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <a
                            href={getWaLink(cust.phone, cust.name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Chat via WhatsApp"
                            className="inline-flex items-center space-x-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg font-bold text-xs transition-colors border border-emerald-200"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>{cust.phone}</span>
                          </a>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap font-medium text-slate-800">
                        {cust.city ? (
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{cust.city}</span>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-slate-600 max-w-xs truncate" title={cust.address}>
                        {cust.address || '-'}
                      </td>

                      <td className="px-4 py-3.5 text-slate-600 text-[11px] max-w-xs truncate" title={cust.notes}>
                        {cust.notes || '-'}
                      </td>

                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1.5">
                          {onSelectCustomerForTransaction && (
                            <button
                              type="button"
                              onClick={() => onSelectCustomerForTransaction(cust)}
                              title="Buat Transaksi Penjualan untuk Customer ini"
                              className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-colors border border-rose-200"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              <span>Penjualan</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditModal(cust)}
                            title="Edit Data Customer"
                            className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteCustomer(cust.id)}
                            title="Hapus Customer"
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
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

      {/* Add / Edit Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-cust-title"
            className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-8 animate-in zoom-in-95 duration-150"
          >
            <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <h3 id="modal-cust-title" className="text-base font-bold">
                  {editingCustomer ? 'Edit Data Customer' : 'Tambah Customer Baru'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                aria-label="Tutup modal"
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-medium">
                  {formError}
                </div>
              )}

              {/* Code & Name */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="cust-code-field" className="block font-bold text-slate-700 mb-1">
                    Kode <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="cust-code-field"
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:bg-white"
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="cust-name-field" className="block font-bold text-slate-700 mb-1">
                    Nama Customer / Toko / Perusahaan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="cust-name-field"
                    type="text"
                    placeholder="cth: Toko Maju Jaya, PT Karya Sejahtera"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white"
                  />
                </div>
              </div>

              {/* Customer Type Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Kategori Pelanggan (Tier Harga) <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Eceran', 'Grosir', 'Partai'] as CustomerType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormType(t)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        formType === t
                          ? t === 'Eceran'
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-xs'
                            : t === 'Grosir'
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-xs'
                            : 'bg-amber-50 border-amber-500 text-amber-900 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs">{t}</span>
                        {formType === t && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      </div>
                      <span className="block text-[10px] text-slate-500 mt-0.5">
                        {t === 'Eceran' ? 'Harga Satuan' : t === 'Grosir' ? 'Harga Reseller' : 'Harga Volume Koli'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Method (CASH & KREDIT) & Credit Termin */}
              <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-2.5">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Metode Pembayaran <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormPaymentMethod('CASH')}
                      className={`p-2 rounded-xl border text-center font-bold text-xs transition-all ${
                        formPaymentMethod === 'CASH'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <span className="block text-xs">CASH</span>
                      <span className="block text-[10px] opacity-80 font-normal">Tunai Langsung</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormPaymentMethod('KREDIT')}
                      className={`p-2 rounded-xl border text-center font-bold text-xs transition-all ${
                        formPaymentMethod === 'KREDIT'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <span className="block text-xs">KREDIT</span>
                      <span className="block text-[10px] opacity-80 font-normal">Tempo Pembayaran</span>
                    </button>
                  </div>
                </div>

                {/* Termin Kredit Options: 7 hari, 14 Hari, 30 Hari */}
                {formPaymentMethod === 'KREDIT' && (
                  <div className="pt-2 border-t border-purple-200 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block font-bold text-purple-900 text-xs">
                        Pilihan Termin Kredit <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[10px] text-purple-700 font-semibold bg-purple-100/70 px-2 py-0.5 rounded-full">
                        Wajib dipilih untuk Kredit
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(['7 Hari', '14 Hari', '30 Hari'] as CreditTerm[]).map((term) => (
                        <button
                          key={term}
                          type="button"
                          onClick={() => setFormCreditTerm(term)}
                          className={`py-2 px-2.5 rounded-xl border text-center font-extrabold text-xs transition-all ${
                            formCreditTerm === term
                              ? 'bg-purple-700 text-white border-purple-700 shadow-xs ring-2 ring-purple-300'
                              : 'bg-white text-purple-900 border-purple-200 hover:bg-purple-50'
                          }`}
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sales Person Selector */}
              <div>
                <label htmlFor="cust-sales-field" className="block font-bold text-slate-700 mb-1">
                  Sales Penanggung Jawab <span className="text-rose-500">*</span>
                </label>
                <select
                  id="cust-sales-field"
                  value={formSalesPerson}
                  onChange={(e) => setFormSalesPerson(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:bg-white"
                >
                  {activeSalesList.map((sp) => (
                    <option key={sp} value={sp}>
                      {sp}
                    </option>
                  ))}
                </select>
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cust-phone-field" className="block font-bold text-slate-700 mb-1">
                    No. Telepon / WhatsApp <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="cust-phone-field"
                    type="text"
                    placeholder="08123456789"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="cust-email-field" className="block font-bold text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    id="cust-email-field"
                    type="email"
                    placeholder="customer@domain.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:bg-white"
                  />
                </div>
              </div>

              {/* City and Address */}
              <div className="space-y-3">
                <div>
                  <label htmlFor="cust-city-field" className="block font-bold text-slate-700 mb-1">
                    Kota / Wilayah
                  </label>
                  <input
                    id="cust-city-field"
                    type="text"
                    placeholder="cth: Jakarta Pusat, Surabaya, Medan"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="cust-address-field" className="block font-bold text-slate-700 mb-1">
                    Alamat Pengiriman / Usaha Lengkap
                  </label>
                  <textarea
                    id="cust-address-field"
                    rows={2}
                    placeholder="cth: Jl. Mangga Dua Raya No. 12, Ruko Mega Mall Blok B"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:bg-white resize-none"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="cust-notes-field" className="block font-bold text-slate-700 mb-1">
                  Catatan Tambahan
                </label>
                <input
                  id="cust-notes-field"
                  type="text"
                  placeholder="cth: Pembayaran tempo 14 hari, ekspedisi langganan J&T Cargo"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:bg-white"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md"
                >
                  {editingCustomer ? 'Simpan Perubahan' : 'Tambahkan Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
