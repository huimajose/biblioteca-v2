import React from 'react';
import { Printer, Ticket, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '../components/ui/Button.tsx';
import jsPDF from 'jspdf';
import { LOGO_WATERMARK } from '@/constants.ts';
import QRCode from 'qrcode';
import { loadWatermarkImage } from '@/utils/pdfWatermark.ts';

interface BorrowTicketProps {
  activity: {
    tid: string | number;
    userId: string;
    userName?: string;
    bookTitle: string;
    bookAuthor: string;
    borrowedDate: string;
    status: string;
    isbn?: string;
    fullName?: string;
    adminId?: string;
    adminName?: string;
    adminEmail?: string;
  };
  onClose: () => void;
}

export const BorrowTicket = ({ activity, onClose }: BorrowTicketProps) => {
  const statusLabel =
    activity.status === 'borrowed' ? 'emprestado' :
    activity.status === 'returned' ? 'devolvido' :
    activity.status;

  const buildTicketPdf = async (format: 'ticket' | 'a4') => {
    const doc = format === 'a4'
      ? new jsPDF('p', 'pt', 'a4')
      : new jsPDF('p', 'mm', [80, 200]);
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginX = format === 'a4' ? 60 : 6;
    const topY = format === 'a4' ? 60 : 10;
    const issueDate = new Date(activity.borrowedDate);
    const year = issueDate.getFullYear();
    const serial = `EMP-${year}/${activity.tid}`;
    const authorizedBy =
      activity.adminName || activity.adminId || activity.adminEmail || 'Sistema';

    let logo: HTMLImageElement | null = null;
    try {
      logo = await loadWatermarkImage(LOGO_WATERMARK);
    } catch {
      logo = null;
    }

    if (logo) {
      const logoW = format === 'a4' ? 64 : 16;
      const logoH = logoW * (logo.height / logo.width);
      doc.addImage(logo, 'PNG', marginX, topY - (format === 'a4' ? 10 : 4), logoW, logoH);
    }

    doc.setFontSize(format === 'a4' ? 18 : 12);
    doc.text('Biblioteca Virtual', marginX + (logo ? (format === 'a4' ? 72 : 20) : 0), topY + (format === 'a4' ? 4 : 2));
    doc.setFontSize(format === 'a4' ? 9 : 7);
    doc.text('Recibo oficial da biblioteca', marginX + (logo ? (format === 'a4' ? 72 : 20) : 0), topY + (format === 'a4' ? 22 : 6));

    doc.setFontSize(format === 'a4' ? 9 : 7);
    doc.text(`Serie: ${serial}`, marginX, topY + (format === 'a4' ? 40 : 14));
    doc.text(`Data: ${issueDate.toLocaleDateString()}`, marginX, topY + (format === 'a4' ? 54 : 19));

    const rightX = pageW - marginX;
    doc.setFontSize(format === 'a4' ? 9 : 7);
    doc.text(`Estado: ${statusLabel}`, rightX, topY + (format === 'a4' ? 40 : 14), { align: 'right' });
    doc.text(`Utilizador: ${activity.userName || activity.userEmail || activity.userId}`, rightX, topY + (format === 'a4' ? 54 : 19), { align: 'right' });

    const tableTop = topY + (format === 'a4' ? 78 : 30);
    const colWidths = format === 'a4'
      ? [40, 260, 120, 80]
      : [10, 34, 18, 12];
    const rowH = format === 'a4' ? 24 : 8;
    const tableW = colWidths.reduce((a, b) => a + b, 0);

    doc.setDrawColor(220);
    doc.setLineWidth(format === 'a4' ? 1 : 0.2);
    doc.rect(marginX, tableTop, tableW, rowH);
    let x = marginX;
    colWidths.forEach((w) => {
      doc.line(x, tableTop, x, tableTop + rowH);
      x += w;
    });
    doc.line(marginX + tableW, tableTop, marginX + tableW, tableTop + rowH);

    doc.setFontSize(format === 'a4' ? 9 : 6);
    doc.text('Qtd', marginX + 4, tableTop + (format === 'a4' ? 16 : 5));
    doc.text('Descricao', marginX + colWidths[0] + 4, tableTop + (format === 'a4' ? 16 : 5));
    doc.text('ISBN', marginX + colWidths[0] + colWidths[1] + 4, tableTop + (format === 'a4' ? 16 : 5));
    doc.text('Estado', marginX + colWidths[0] + colWidths[1] + colWidths[2] + 4, tableTop + (format === 'a4' ? 16 : 5));

    const bodyTop = tableTop + rowH;
    doc.rect(marginX, bodyTop, tableW, rowH);
    x = marginX;
    colWidths.forEach((w) => {
      doc.line(x, bodyTop, x, bodyTop + rowH);
      x += w;
    });
    doc.line(marginX + tableW, bodyTop, marginX + tableW, bodyTop + rowH);

    doc.setFontSize(format === 'a4' ? 9 : 6);
    doc.text('1', marginX + 4, bodyTop + (format === 'a4' ? 16 : 5));
    const title = String(activity.bookTitle || 'N/D');
    const author = String(activity.bookAuthor || '');
    const desc = author ? `${title} — ${author}` : title;
    doc.text(desc, marginX + colWidths[0] + 4, bodyTop + (format === 'a4' ? 16 : 5), { maxWidth: colWidths[1] - 8 });
    doc.text(String(activity.isbn || 'N/D'), marginX + colWidths[0] + colWidths[1] + 4, bodyTop + (format === 'a4' ? 16 : 5), { maxWidth: colWidths[2] - 8 });
    doc.text(statusLabel, marginX + colWidths[0] + colWidths[1] + colWidths[2] + 4, bodyTop + (format === 'a4' ? 16 : 5), { maxWidth: colWidths[3] - 8 });

    const qrPayload = JSON.stringify({
      tid: activity.tid,
      user: activity.userName || activity.userEmail || activity.userId,
      isbn: activity.isbn || '',
      status: statusLabel,
      date: activity.borrowedDate,
      fullName: activity.fullName || '',
    });

    try {
      const qr = await QRCode.toDataURL(qrPayload, { margin: 1, width: 140 });
      const qrSize = format === 'a4' ? 110 : 28;
      const qrX = pageW - marginX - qrSize;
      const qrY = bodyTop + rowH + (format === 'a4' ? 40 : 10);
      doc.addImage(qr, 'PNG', qrX, qrY, qrSize, qrSize);
      doc.setFontSize(format === 'a4' ? 7 : 6);
      doc.text('Validar talao', qrX, qrY + qrSize + (format === 'a4' ? 14 : 6));
    } catch {
      // ignore qr failure
    }

    doc.setFontSize(format === 'a4' ? 7 : 6);
    doc.text(`Autorizado por: ${authorizedBy}`, marginX, pageH - (format === 'a4' ? 56 : 16));
    doc.text(`Data: ${issueDate.toLocaleDateString()}`, marginX, pageH - (format === 'a4' ? 44 : 10));

    return doc;
  };

  const exportTicketPdf = async (format: 'ticket' | 'a4') => {
    const doc = await buildTicketPdf(format);
    doc.save(`talao-${activity.tid}-${format}.pdf`);
  };

  const printTicket = async (format: 'ticket' | 'a4') => {
    const doc = await buildTicketPdf(format);
    doc.autoPrint();
    const url = doc.output('bloburl');
    window.open(url, '_blank');
  };

  console.log("BorrowTicket renderizado com:", activity);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 print:p-0 print:bg-white print:static print:inset-auto">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:max-w-none print:w-full"
      >
        <div className="p-6 border-b border-dashed border-gray-200 flex justify-between items-center print:hidden">
          <h3 className="font-bold flex items-center gap-2"><Ticket className="w-5 h-5 text-lime-600" /> Talao de requisicao</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-8 space-y-6 text-center">
          <div className="space-y-1">
            <h2 className="text-2xl font-black tracking-tighter uppercase">Biblioteca Virtual</h2>
            <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Recibo oficial da biblioteca</p>
          </div>

          <div className="py-4 border-y border-dashed border-gray-100 space-y-4">
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase">Titulo do livro</p>
              <p className="font-bold text-lg leading-tight">{activity.bookTitle}</p>
              <p className="text-sm text-gray-500 italic">{activity.bookAuthor}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-left">
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase">ID do utilizador</p>
                <p className="text-xs">{activity.fullName || activity.userEmail || activity.userId}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase">ISBN</p>
                <p className="font-mono text-xs">{activity.isbn || 'N/D'}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Data</p>
                <p className="text-xs font-bold">{new Date(activity.borrowedDate).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Estado</p>
                <p className="text-xs font-bold uppercase text-lime-600">{statusLabel}</p>
              </div>
            </div>
          </div>

          <div className="pt-4 space-y-2">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-2">ID da transacao</p>
              <p className="font-mono text-[10px] break-all">#{activity.tid}</p>
            </div>
            <p className="text-[9px] text-gray-400 italic">Guarde este talao para os seus registos. Devolva o livro no prazo indicado para evitar multas.</p>
          </div>
        </div>

        <div className="p-6 bg-gray-50 flex flex-col gap-3 print:hidden">
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Fechar</Button>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1 flex items-center justify-center gap-2" onClick={() => printTicket('ticket')}>
              <Printer className="w-4 h-4" /> Imprimir ticket
            </Button>
            <Button variant="secondary" className="flex-1 flex items-center justify-center gap-2" onClick={() => printTicket('a4')}>
              <Printer className="w-4 h-4" /> Imprimir A4
            </Button>
          </div>
          <div className="flex gap-3">
            <Button className="flex-1 flex items-center justify-center gap-2" onClick={() => exportTicketPdf('ticket')}>
              <Printer className="w-4 h-4" /> Baixar ticket
            </Button>
            <Button className="flex-1 flex items-center justify-center gap-2" onClick={() => exportTicketPdf('a4')}>
              <Printer className="w-4 h-4" /> Baixar A4
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
