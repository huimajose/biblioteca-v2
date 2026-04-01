import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { LOGO_WATERMARK } from '@/constants.ts';

interface StudentStickerProps {
  userId: string;
  fullName?: string;
  studentNumber?: string;
  avatarUrl?: string;
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

export const StudentSticker = ({ userId, fullName, studentNumber, avatarUrl }: StudentStickerProps) => {
  const [qr, setQr] = useState<string>('');
  const [avatarData, setAvatarData] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const issueDate = useMemo(() => new Date().toLocaleDateString(), []);

  useEffect(() => {
    const payload = JSON.stringify({
      app: 'BIBLIOTECA-DIGITAL-ISPI',
      type: 'student',
      id: userId,
      name: fullName || null,
      studentNumber: studentNumber || null,
    });
    QRCode.toDataURL(payload, { width: 140, margin: 1 })
      .then(setQr)
      .catch(() => setQr(''));
  }, [userId, fullName, studentNumber]);

  useEffect(() => {
    if (!avatarUrl) {
      setAvatarData(null);
      return;
    }
    loadImage(avatarUrl)
      .then((img) => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        setAvatarData(canvas.toDataURL('image/png'));
      })
      .catch(() => setAvatarData(null));
  }, [avatarUrl]);

  const initials = useMemo(() => {
    if (fullName) {
      return fullName
        .split(' ')
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase();
    }
    return userId.slice(0, 2).toUpperCase();
  }, [fullName, userId]);

  const downloadPdf = async () => {
    const doc = new jsPDF('p', 'pt', [360, 220]);

    let watermark: HTMLImageElement | null = null;
    try {
      watermark = await loadImage(LOGO_WATERMARK);
    } catch {
      watermark = null;
    }
    // Frente
    doc.setFillColor(245, 255, 230);
    doc.rect(0, 0, 360, 220, 'F');
    if (watermark) {
      if ((doc as any).GState && doc.setGState) {
        doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
      }
      doc.addImage(watermark, 'PNG', 90, 55, 180, 180);
      if ((doc as any).GState && doc.setGState) {
        doc.setGState(new (doc as any).GState({ opacity: 1 }));
      }
    }
    doc.setFillColor(101, 163, 13);
    doc.rect(0, 0, 360, 50, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text('Biblioteca Digital ISPI', 16, 30);
    doc.setFontSize(9);
    doc.text('Cartao de Estudante', 16, 44);
    doc.setTextColor(0, 0, 0);

    if (avatarData) {
      doc.addImage(avatarData, 'PNG', 16, 70, 46, 46);
    } else {
      doc.setDrawColor(101, 163, 13);
      doc.setFillColor(220, 252, 231);
      doc.circle(39, 93, 23, 'FD');
      doc.setTextColor(21, 128, 61);
      doc.text(initials, 33, 98);
      doc.setTextColor(0, 0, 0);
    }

    doc.setFontSize(9);
    
    if (fullName) doc.text(`Nome: ${fullName}`, 72, 102);
    if (studentNumber) doc.text(`Numero: ${studentNumber}`, 72, 118);
    doc.text(`Emissao: ${issueDate}`, 72, 134);

    if (qr) {
      doc.addImage(qr, 'PNG', 260, 70, 80, 80);
    }

    // Verso
    doc.addPage([360, 220], 'p');
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 360, 220, 'F');
    if (watermark) {
      if ((doc as any).GState && doc.setGState) {
        doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
      }
      doc.addImage(watermark, 'PNG', 110, 40, 140, 140);
      if ((doc as any).GState && doc.setGState) {
        doc.setGState(new (doc as any).GState({ opacity: 1 }));
      }
    }
    doc.setFontSize(10);
    doc.setTextColor(101, 163, 13);
    doc.text('Cartao de Estudante - Verso', 16, 26);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.text(
      'Este cartao identifica o estudante na Biblioteca Virtual. Apresente-o sempre que requisitar\n' +
      'livros fisicos. A cedencia a terceiros e proibida.',
      16,
      50
    );
    if (qr) {
      doc.addImage(qr, 'PNG', 16, 90, 100, 100);
    }
    doc.setFontSize(7);
    doc.text('Valide este QR para confirmar a identidade do estudante.', 130, 110);

    doc.save('cartao-estudante.pdf');
  };

  const downloadPng = async () => {
    if (!cardRef.current) return;
    const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = 'cartao-estudante.png';
    link.click();
  };

  return (
    <div ref={cardRef} className="w-full md:w-72 bg-white border border-lime-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-lime-600 font-bold">Cartao digital</p>
          <p className="text-lg font-black leading-tight text-center">Estudante</p>
          <p className="text-xs text-gray-500 text-center">Biblioteca Digital</p>
        </div>
        <div className="bg-lime-600 text-white text-[10px] font-bold px-2 py-1 rounded-full">Verificado</div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        {avatarData ? (
          <img src={avatarData} alt="Avatar" className="w-12 h-12 rounded-full object-cover border border-lime-200" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-lime-100 text-lime-700 flex items-center justify-center font-bold">
            {initials}
          </div>
        )}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Emissao</p>
          <p className="text-xs text-gray-700">{issueDate}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        {qr ? (
          <img src={qr} alt="QR" className="w-20 h-20 rounded-lg border border-gray-100" />
        ) : (
          <div className="w-20 h-20 rounded-lg border border-dashed border-gray-200" />
        )}
        <div className="space-y-1">
         
          {fullName && (
            <>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Nome</p>
              <p className="text-xs text-gray-700">{fullName}</p>
            </>
          )}
          {studentNumber && (
            <>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Numero</p>
              <p className="text-xs text-gray-700">{studentNumber}</p>
            </>
          )}
        </div>
      </div>

      <button
        className="mt-4 w-full text-xs font-bold uppercase tracking-widest bg-lime-600 text-white py-2 rounded-lg"
        onClick={downloadPdf}
      >
        Baixar cartao em PDF
      </button>
      <button
        className="mt-2 w-full text-xs font-bold uppercase tracking-widest border border-lime-200 text-lime-700 py-2 rounded-lg"
        onClick={downloadPng}
      >
        Baixar cartao em PNG
      </button>
    </div>
  );
};
