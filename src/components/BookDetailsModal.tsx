import React from 'react';
import { X, BookOpen, BookmarkPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button.tsx';
import { DEFAULT_BOOK_COVER } from '@/constants.ts';

interface BookDetailsModalProps {
  book: any;
  onClose: () => void;
  onBorrow: (bookId: number) => void;
  onReserve: (bookId: number) => void;
  onAddToShelf: (bookId: number) => void;
  resolveFileUrl: (fileUrl?: string | null) => string | null;
  onReadPdf: (book: any) => void;
}

export const BookDetailsModal = ({
  book,
  onClose,
  onBorrow,
  onReserve,
  onAddToShelf,
  resolveFileUrl,
  onReadPdf,
}: BookDetailsModalProps) => {
  const cover = book.cover || DEFAULT_BOOK_COVER;
  const pdfUrl = resolveFileUrl(book.fileUrl);
  const hasPhysical = (book.availableCopies ?? 0) > 0;
  const hasDigital = Boolean(pdfUrl);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-lg">Detalhes do livro</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
          <img
            src={cover}
            alt={book.title}
            className="w-full h-[320px] object-cover rounded-xl shadow-md"
            referrerPolicy="no-referrer"
          />
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-black">{book.title}</h2>
              <p className="text-gray-500">{book.author}</p>
              <p className="text-xs text-gray-400 mt-1">ISBN: {book.isbn}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
              <div>
                <p className="text-[10px] uppercase text-gray-400">curso</p>
                <p className="font-semibold">{book.genre || 'N/D'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-gray-400">Disponibilidade</p>
                <p className="font-semibold">
                  {hasDigital && hasPhysical ? 'Digital + Fisico' : (hasDigital ? 'Digital' : `${book.availableCopies} / ${book.totalCopies}`)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-gray-400">Tipo</p>
                <p className="font-semibold">
                  {hasDigital && hasPhysical ? 'Hibrido' : (hasDigital ? 'Digital' : 'Fisico')}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-gray-400">ID</p>
                <p className="font-semibold">#{book.id}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {hasDigital && (
                <>
                  <Button
                    className="text-xs uppercase bg-purple-600 hover:bg-purple-700"
                    onClick={() => onReadPdf(book)}
                  >
                    <BookOpen className="w-4 h-4" /> Ler PDF
                  </Button>
                  <Button
                    className="text-xs uppercase"
                    onClick={() => onAddToShelf(book.id)}
                  >
                    <BookmarkPlus className="w-4 h-4" /> Adicionar a estante
                  </Button>
                </>
              )}
              {hasPhysical && (
                book.availableCopies > 0 ? (
                  <Button className="text-xs uppercase" onClick={() => onBorrow(book.id)}>
                    Requisitar emprestimo
                  </Button>
                ) : (
                  <Button className="text-xs uppercase" variant="secondary" onClick={() => onReserve(book.id)}>
                    Reservar
                  </Button>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
