import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatRupiah, formatNumber } from './inventory.js';

export interface NotaPdfData {
  transactionId: string;
  date: string;
  time: string;
  recipient: string;
  paymentMethod?: string;
  creditTerm?: string;
  dueDate: string;
  referenceDoc?: string;
  salesPerson?: string;
  itemName: string;
  sku: string;
  category?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

export function generateNotaPdf(data: NotaPdfData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 14;
  const rightMargin = pageWidth - 14;

  // --- 1. Header Nota ---
  // Left: Company / Store details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text('Pusat Grosir & Eceran', leftMargin, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('Jl. Raya Distribusi Utama No. 88, Indonesia', leftMargin, 23);

  // Right: NOTA PENJUALAN Badge & Transaksi Info
  doc.setFillColor(209, 250, 229); // emerald-100
  doc.roundedRect(rightMargin - 45, 12, 45, 8, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(6, 95, 70); // emerald-800
  doc.text('NOTA PENJUALAN', rightMargin - 22.5, 17.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(data.transactionId, rightMargin, 25, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${data.date} • ${data.time}`, rightMargin, 29.5, { align: 'right' });

  // Divider Line
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.line(leftMargin, 33, rightMargin, 33);

  // --- 2. Information Box (Pelanggan & Sales) ---
  const boxTop = 36;
  const boxHeight = 28;
  const boxWidth = rightMargin - leftMargin;

  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(leftMargin, boxTop, boxWidth, boxHeight, 2, 2, 'FD');

  // Left column: Pelanggan
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('KEPADA PELANGGAN:', leftMargin + 4, boxTop + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(data.recipient || '-', leftMargin + 4, boxTop + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const paymentText = `Metode: ${data.paymentMethod || 'CASH'}${
    data.creditTerm && data.paymentMethod === 'KREDIT' ? ` (${data.creditTerm})` : ''
  }`;
  doc.text(paymentText, leftMargin + 4, boxTop + 16);

  doc.text(`Jatuh Tempo: ${data.dueDate || data.date}`, leftMargin + 4, boxTop + 20.5);

  if (data.referenceDoc) {
    doc.text(`No. DO/Ref: ${data.referenceDoc}`, leftMargin + 4, boxTop + 25);
  }

  // Right column: Tim Sales (Petugas Gudang & Kategori Harga DIHILANGKAN)
  const colMid = leftMargin + boxWidth / 2 + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('TIM SALES PENANGGUNG JAWAB:', colMid, boxTop + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(190, 18, 60); // rose-700
  doc.text(data.salesPerson || 'Belum ditugaskan', colMid, boxTop + 11);

  // --- 3. Items Table ---
  const tableStartY = boxTop + boxHeight + 4;

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: leftMargin, right: 14 },
    head: [['No', 'Nama Barang & SKU', 'Kuantitas', 'Harga Satuan', 'Subtotal']],
    body: [
      [
        '1',
        `${data.itemName}\n[SKU: ${data.sku}${data.category ? ` • ${data.category}` : ''}]`,
        `${formatNumber(data.quantity)} ${data.unit}`,
        formatRupiah(data.unitPrice),
        formatRupiah(data.totalPrice),
      ],
    ],
    foot: [
      ['', '', '', 'TOTAL PEMBAYARAN:', formatRupiah(data.totalPrice)],
    ],
    theme: 'plain',
    headStyles: {
      fillColor: [15, 118, 110], // teal-700 / emerald
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59],
      cellPadding: 3.5,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    footStyles: {
      fontSize: 9.5,
      fontStyle: 'bold',
      textColor: [15, 118, 110],
      fillColor: [248, 250, 252],
      cellPadding: 3.5,
      lineColor: [203, 213, 225],
      lineWidth: 0.3,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 38, halign: 'right', fontStyle: 'bold' },
    },
  });

  // Get table end Y position
  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 110;

  // --- 4. Notes & Automatic Notice Footer ---
  const notesY = finalY + 6;

  // Catatan Transaksi
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Catatan Transaksi:', leftMargin, notesY);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(data.notes || 'Terima kasih atas kepercayaan Anda berbelanja.', leftMargin, notesY + 4.5);

  // Footer automatic print notice (NO signature block)
  doc.setDrawColor(241, 245, 249);
  doc.setLineWidth(0.3);
  doc.line(leftMargin, notesY + 11, rightMargin, notesY + 11);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(
    'Nota ini diprint secara otomatis, tidak memerlukan tanda tangan',
    pageWidth / 2,
    notesY + 16,
    { align: 'center' }
  );

  // Trigger download
  doc.save(`nota_${data.transactionId}.pdf`);
}
