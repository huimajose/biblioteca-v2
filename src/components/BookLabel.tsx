import React from 'react';
import { Printer, X, Tag } from 'lucide-react';
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
  };
  onClose: () => void;
}

export const BookLabelContent = ({ book }: { book: BookLabelProps['book'] }) => (
  <div className="relative w-64 p-6 border-2 border-black rounded-lg space-y-3 bg-white overflow-hidden">
    <img
      src={LOGO_WATERMARK}
      alt=""
      className="pointer-events-none absolute inset-0 m-auto w-36 h-36 opacity-10"
    />
    <div className="border-b border-black pb-2">
      <h2 className="text-lg font-black tracking-tighter uppercase">Biblioteca Virtual</h2>
      <p className="text-[7px] font-bold uppercase tracking-widest">Propriedade da biblioteca</p>
    </div>

    <div className="space-y-1">
      <p className="text-[9px] font-bold uppercase text-gray-500">Titulo</p>
      <p className="font-bold text-[11px] leading-tight line-clamp-2">{book.title}</p>
    </div>

    <div className="grid grid-cols-2 gap-2 text-left">
      <div>
        <p className="text-[7px] font-bold uppercase text-gray-500">Autor</p>
        <p className="text-[9px] font-medium truncate">{book.author}</p>
      </div>
      <div>
        <p className="text-[7px] font-bold uppercase text-gray-500">curso</p>
        <p className="text-[9px] font-medium truncate">{book.genre}</p>
      </div>
    </div>

    <div className="pt-2 border-t border-black flex flex-col items-center gap-2">
      <div className="w-full h-8 bg-black flex items-center justify-center">
        <div className="flex gap-[1px] h-full bg-white px-2 items-center">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="bg-black" style={{ width: Math.random() > 0.5 ? '2px' : '1px', height: '80%' }} />
          ))}
        </div>
      </div>
      <p className="font-mono text-[9px] font-bold tracking-widest">ISBN: {book.isbn}</p>
      <p className="font-mono text-[7px] text-gray-400">BOOK_ID: {book.id}</p>
    </div>
  </div>
);

export const BookLabel = ({ book, onClose }: BookLabelProps) => {
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
          <BookLabelContent book={book} />

          <p className="mt-6 text-xs text-gray-500 print:hidden italic">Esta etiqueta foi concebida para ser impressa e colocada na lombada do livro ou na capa interior.</p>
        </div>

        <div className="p-6 bg-gray-50 flex gap-3 print:hidden">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Fechar</Button>
          <Button className="flex-1 flex items-center justify-center gap-2" onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> Imprimir etiqueta
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
