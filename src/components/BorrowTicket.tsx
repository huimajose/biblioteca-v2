import React from 'react';
import { Printer, Ticket, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '../components/ui/Button.tsx';
import jsPDF from 'jspdf';
import { LOGO_WATERMARK } from '@/constants.ts';
import QRCode from 'qrcode';

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
  };
  onClose: () => void;
}

export const BorrowTicket = ({ activity, onClose }: BorrowTicketProps) => {
  const statusLabel =
    activity.status === 'borrowed' ? 'emprestado' :
    activity.status === 'returned' ? 'devolvido' :
    activity.status;

  const buildTicketPdf = async (format: 'a5' | 'a4') => {
    const doc = new jsPDF('p', 'pt', format);
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginX = format === 'a4' ? 60 : 40;
    const topY = format === 'a4' ? 60 : 40;

    doc.setFontSize(18);
    doc.text('Biblioteca Virtual', marginX, topY);
    doc.setFontSize(9);
    doc.text('Recibo oficial da biblioteca', marginX, topY + 18);

    doc.setFontSize(10);
    doc.text('Titulo do livro', marginX, topY + 48);
    doc.setFontSize(13);
    doc.text(String(activity.bookTitle || 'N/D'), marginX, topY + 70, { maxWidth: pageW - marginX * 2 });
    doc.setFontSize(9);
    doc.text(String(activity.bookAuthor || ''), marginX, topY + 86);

    doc.setFontSize(9);
    doc.text(`Utilizador: ${activity.userName || activity.userEmail || activity.userId}`, marginX, topY + 118);
    doc.text(`ISBN: ${activity.isbn || 'N/D'}`, marginX, topY + 134);
    doc.text(`Data: ${new Date(activity.borrowedDate).toLocaleDateString()}`, marginX, topY + 150);
    doc.text(`Estado: ${statusLabel}`, marginX, topY + 166);

    doc.setFontSize(9);
    doc.text('ID da transacao', marginX, topY + 198);
    doc.setFontSize(8);
    doc.text(`#${activity.tid}`, marginX, topY + 214, { maxWidth: pageW - marginX * 2 });

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
      const qrSize = format === 'a4' ? 110 : 80;
      const qrX = pageW - marginX - qrSize;
      const qrY = topY + 190;
      doc.addImage(qr, 'PNG', qrX, qrY, qrSize, qrSize);
      doc.setFontSize(7);
      doc.text('Validar talao', qrX, qrY + qrSize + 14);
    } catch {
      // ignore qr failure
    }

    doc.setFontSize(7);
    doc.text('Guarde este talao para os seus registos.', marginX, pageH - 56);
    doc.text('Devolva o livro no prazo indicado para evitar multas.', marginX, pageH - 44);

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const imgLoaded = await new Promise<HTMLImageElement>((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = LOGO_WATERMARK;
      });
      const wmW = format === 'a4' ? 260 : 220;
      const wmH = wmW * (imgLoaded.height / imgLoaded.width);
      const wmX = (pageW - wmW) / 2;
      const wmY = (pageH - wmH) / 2;
      if ((doc as any).GState && doc.setGState) {
        doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
      }
      doc.addImage(imgLoaded, 'PNG', wmX, wmY, wmW, wmH);
      if ((doc as any).GState && doc.setGState) {
        doc.setGState(new (doc as any).GState({ opacity: 1 }));
      }
    } catch {
      // ignore watermark failure
    }

    return doc;
  };

  const exportTicketPdf = async (format: 'a5' | 'a4') => {
    const doc = await buildTicketPdf(format);
    doc.save(`talao-${activity.tid}-${format}.pdf`);
  };

  const printTicket = async (format: 'a5' | 'a4') => {
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
            <Button variant="secondary" className="flex-1 flex items-center justify-center gap-2" onClick={() => printTicket('a5')}>
              <Printer className="w-4 h-4" /> Imprimir pequeno
            </Button>
            <Button variant="secondary" className="flex-1 flex items-center justify-center gap-2" onClick={() => printTicket('a4')}>
              <Printer className="w-4 h-4" /> Imprimir A4
            </Button>
          </div>
          <div className="flex gap-3">
            <Button className="flex-1 flex items-center justify-center gap-2" onClick={() => exportTicketPdf('a5')}>
              <Printer className="w-4 h-4" /> Baixar PDF pequeno
            </Button>
            <Button className="flex-1 flex items-center justify-center gap-2" onClick={() => exportTicketPdf('a4')}>
              <Printer className="w-4 h-4" /> Baixar PDF A4
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
