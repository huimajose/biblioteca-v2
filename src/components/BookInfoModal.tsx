import React, { useEffect } from 'react';
import { X, ListChecks, Star, Loader2 } from 'lucide-react';
import { DEFAULT_BOOK_COVER } from '@/constants.ts';
import { Button } from '@/components/ui/Button.tsx';

interface BookInfoModalProps {
  book: any;
  onClose: () => void;
  onToggleFavorite?: (bookId: number) => void;
  onOpenReadingLists?: (book: any) => void;
  favoriteActive?: boolean;
  favoriteLoading?: boolean;
}

export const BookInfoModal = ({
  book,
  onClose,
  onToggleFavorite,
  onOpenReadingLists,
  favoriteActive = false,
  favoriteLoading = false,
}: BookInfoModalProps) => {
  useEffect(() => {
    if (!book?.id || typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('recentBookClicks');
      const list = raw ? (JSON.parse(raw) as number[]) : [];
      const cleaned = Array.isArray(list) ? list.filter((v) => Number.isFinite(v)) : [];
      const next = [book.id, ...cleaned.filter((id) => id !== book.id)].slice(0, 15);
      window.localStorage.setItem('recentBookClicks', JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }, [book?.id]);

  useEffect(() => {
    if (!book?.id || typeof window === 'undefined') return;
    const userId = window.localStorage.getItem('userId');
    if (!userId) return;
    fetch('/api/books/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId: book.id, userId }),
    }).catch(() => null);
  }, [book?.id]);
  const cover = book?.cover || DEFAULT_BOOK_COVER;
  const available = book?.availableCopies ?? book?.available ?? 0;
  const total = book?.totalCopies ?? book?.total ?? 0;
  const hasDigital = Boolean(book?.fileUrl) || Boolean(book?.isDigital);
  const hasPhysical = (available ?? 0) > 0 || (total ?? 0) > 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-lg">Detalhes do livro</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
          <img
            src={cover}
            alt={book?.title}
            className="w-full h-[300px] object-cover rounded-xl shadow-md"
            referrerPolicy="no-referrer"
          />
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-black">{book?.title || 'N/D'}</h2>
              <p className="text-gray-500">{book?.author || 'N/D'}</p>
              {book?.isbn && <p className="text-xs text-gray-400 mt-1">ISBN: {book?.isbn}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
              <div>
                <p className="text-[10px] uppercase text-gray-400">Curso</p>
                <p className="font-semibold">{book?.genre || 'N/D'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-gray-400">Disponibilidade</p>
                <p className="font-semibold">
                  {hasDigital && hasPhysical ? 'Digital + Fisico' : (hasDigital ? 'Digital' : `${available} / ${total}`)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-gray-400">Tipo</p>
                <p className="font-semibold">
                  {hasDigital && hasPhysical ? 'Hibrido' : (hasDigital ? 'Digital' : 'Fisico')}
                </p>
              </div>
              {book?.id && (
                <div>
                  <p className="text-[10px] uppercase text-gray-400">ID</p>
                  <p className="font-semibold">#{book?.id}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
              {book?.editora && (
                <div>
                  <p className="uppercase text-gray-400">Editora</p>
                  <p className="font-semibold">{book?.editora}</p>
                </div>
              )}
              {book?.cdu && (
                <div>
                  <p className="uppercase text-gray-400">CDU</p>
                  <p className="font-semibold">{book?.cdu}</p>
                </div>
              )}
              {book?.anoEdicao && (
                <div>
                  <p className="uppercase text-gray-400">Ano</p>
                  <p className="font-semibold">{book?.anoEdicao}</p>
                </div>
              )}
              {book?.edicao && (
                <div>
                  <p className="uppercase text-gray-400">Edicao</p>
                  <p className="font-semibold">{book?.edicao}</p>
                </div>
              )}
              {book?.prateleira && (
                <div>
                  <p className="uppercase text-gray-400">Prateleira</p>
                  <p className="font-semibold">{book?.prateleira}</p>
                </div>
              )}
            </div>

            {(onToggleFavorite || onOpenReadingLists) && (
              <div className="flex flex-wrap gap-2 pt-2">
                {onToggleFavorite && (
                  <Button
                    className={`text-xs uppercase ${favoriteActive ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}`}
                    variant={favoriteActive ? 'primary' : 'secondary'}
                    onClick={() => onToggleFavorite(book.id)}
                    disabled={favoriteLoading}
                  >
                    {favoriteLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Star className={`w-4 h-4 ${favoriteActive ? 'fill-current' : ''}`} />
                    )}
                    {favoriteActive ? 'Favorito' : 'Ler depois'}
                  </Button>
                )}
                {onOpenReadingLists && (
                  <Button
                    className="text-xs uppercase"
                    variant="secondary"
                    onClick={() => onOpenReadingLists(book)}
                  >
                    <ListChecks className="w-4 h-4" />
                    Guardar em lista
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
