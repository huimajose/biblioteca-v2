import React, { useState } from 'react';
import { bookLabelLines, physicalCopyNumbers } from '@/utils/bookCatalog';
import { Printer, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/Button.tsx';
import { LOGO_WATERMARK } from '@/constants.ts';

interface BookLabelProps {
  book: {
    id: number;
    title: string;
    author: string;
    isbn: string;
    genre: string;
    cdu?: string | null;
    catalogCode?: string | null;
    courseSequence?: number | null;
    totalCopies?: number;
    prateleira?: number | string | null;
    armario?: number | string | null;
  };
  onClose: () => void;
}

export const BookLabelContent = ({ book, copy = 1 }: { book: BookLabelProps['book']; copy?: number }) => (
  <div className="relative w-64 border-2 border-black rounded-lg bg-white overflow-hidden text-center">
    <img src={LOGO_WATERMARK} alt="" className="pointer-events-none absolute inset-0 m-auto w-36 opacity-10" />
    {bookLabelLines(book, copy).map((line, index) => (
      <p key={index} className={index === 0 ? 'relative border-b border-black px-3 py-3 text-lg font-bold' : 'relative py-2 font-mono text-xl font-bold'}>{line}</p>
    ))}
  </div>
);

export const BookLabel = ({ book, onClose }: BookLabelProps) => {
  const [copy, setCopy] = useState(1);
  const copies = physicalCopyNumbers(book);
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 print:p-0 print:bg-white print:static print:inset-auto">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:max-w-none print:w-full"
      >
        <div className="p-6 border-b border-gray-100 flex justify-between items-center print:hidden">
          
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="p-8 flex flex-col items-center text-center">
          {copies.length > 0 ? <>
            <label className="mb-4 text-sm print:hidden">Exemplar
              <select className="ml-2 border rounded p-2" value={copy} onChange={e => setCopy(Number(e.target.value))}>
                {copies.map(number => <option key={number} value={number}>Ex. {number}</option>)}
              </select>
            </label>
            <BookLabelContent book={book} copy={copy} />
          </> : <p>Este livro não tem exemplares físicos para etiquetar.</p>}

          <p className="mt-6 text-xs text-gray-500 print:hidden italic">Esta etiqueta foi concebida para ser impressa e colocada na lombada do livro ou na capa interior.</p>
        </div>

        <div className="p-6 bg-gray-50 flex gap-3 print:hidden">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Fechar</Button>
          <Button className="flex-1 flex items-center justify-center gap-2" disabled={!copies.length} onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> Imprimir etiqueta
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
