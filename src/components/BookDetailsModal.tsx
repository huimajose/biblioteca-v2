import React from 'react';
import { X, BookOpen, BookmarkPlus, Loader2, Star } from 'lucide-react';
import { Button } from '@/components/ui/Button.tsx';
import { DEFAULT_BOOK_COVER } from '@/constants.ts';

interface BookDetailsModalProps {
  book: any;
  onClose: () => void;
  onBorrow: (bookId: number) => void;
  onReserve: (bookId: number) => void;
  onAddToShelf: (bookId: number) => void;
  onToggleFavorite?: (bookId: number) => void;
  onOpenReadingLists?: (book: any) => void;
  resolveFileUrl: (fileUrl?: string | null) => string | null;
  onReadPdf: (book: any) => void;
  readingProgress?: {
    currentPage?: number | null;
    totalPages?: number | null;
    progressPercent?: number | null;
    lastReadAt?: string | null;
  } | null;
  borrowLoading?: boolean;
  reserveLoading?: boolean;
  shelfLoading?: boolean;
  shelfDisabled?: boolean;
  favoriteLoading?: boolean;
  favoriteActive?: boolean;
  borrowDisabled?: boolean;
  borrowDisabledLabel?: string;
}

export const BookDetailsModal = ({
  book,
  onClose,
  onBorrow,
  onReserve,
  onAddToShelf,
  onToggleFavorite,
  onOpenReadingLists,
  resolveFileUrl,
  onReadPdf,
  readingProgress = null,
  borrowLoading = false,
  reserveLoading = false,
  shelfLoading = false,
  shelfDisabled = false,
  favoriteLoading = false,
  favoriteActive = false,
  borrowDisabled = false,
  borrowDisabledLabel = 'Ja requisitado',
}: BookDetailsModalProps) => {
  const cover = book.cover || DEFAULT_BOOK_COVER;
  const pdfUrl = resolveFileUrl(book.fileUrl);
  const hasPhysical = (book.availableCopies ?? 0) > 0;
  const hasDigital = Boolean(pdfUrl);
  const isOutOfStock = !hasPhysical && !hasDigital && (book.availableCopies ?? 0) <= 0;
  const hasReadingProgress = Boolean((readingProgress?.currentPage ?? 0) > 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4 sm:px-6">
          <h3 className="font-bold text-lg">Detalhes do livro</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto p-4 sm:p-6 md:grid-cols-[220px_1fr] md:gap-6">
          <img
            src={cover}
            alt={book.title}
            className="mx-auto h-[240px] w-full max-w-[220px] rounded-xl object-cover shadow-md sm:h-[300px] md:mx-0 md:h-[320px] md:max-w-none"
            referrerPolicy="no-referrer"
          />
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-black">{book.title}</h2>
              <p className="text-gray-500">{book.author}</p>
              <p className="text-xs text-gray-400 mt-1">ISBN: {book.isbn}</p>
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm text-gray-600 sm:grid-cols-2">
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

            {hasDigital && hasReadingProgress && (
              <div className="rounded-2xl border border-lime-100 bg-lime-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-lime-700">Continuar leitura</p>
                <p className="mt-1 text-sm text-lime-900">
                  Parou na pagina {readingProgress?.currentPage}
                  {readingProgress?.totalPages ? ` de ${readingProgress.totalPages}` : ''}.
                </p>
                <p className="text-xs text-lime-700">
                  Progresso: {readingProgress?.progressPercent ?? 0}%
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {hasDigital && (
                <>
                  <Button
                    className="text-xs uppercase bg-purple-600 hover:bg-purple-700"
                    onClick={() => onReadPdf(book)}
                  >
                    <BookOpen className="w-4 h-4" /> Ler PDF
                  </Button>
                  {hasReadingProgress && (
                    <Button
                      className="text-xs uppercase bg-lime-600 hover:bg-lime-700"
                      onClick={() => onReadPdf(book)}
                    >
                      <BookOpen className="w-4 h-4" /> Continuar da pagina {readingProgress?.currentPage}
                    </Button>
                  )}
                  <Button
                    className="text-xs uppercase"
                    onClick={() => onAddToShelf(book.id)}
                    disabled={shelfLoading || shelfDisabled}
                  >
                    {shelfLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <BookmarkPlus className="w-4 h-4" />
                    )}
                    {shelfDisabled ? 'Ja na estante' : shelfLoading ? 'A processar...' : 'Adicionar a estante'}
                  </Button>
                </>
              )}
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
                  Guardar em lista
                </Button>
              )}
              {hasPhysical && (
                book.availableCopies > 0 ? (
                  <Button className="text-xs uppercase" onClick={() => onBorrow(book.id)} disabled={borrowLoading || borrowDisabled}>
                    {borrowDisabled ? (
                      borrowDisabledLabel
                    ) : borrowLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        A processar...
                      </>
                    ) : (
                      'Requisitar emprestimo'
                    )}
                  </Button>
                ) : (
                  <Button className="text-xs uppercase" variant="secondary" onClick={() => onReserve(book.id)} disabled={reserveLoading || isOutOfStock}>
                    {isOutOfStock ? 'Esgotado' : reserveLoading ? 'A processar...' : 'Reservar'}
                  </Button>
                )
              )}
              {!hasPhysical && !hasDigital && (
                <Button className="text-xs uppercase" variant="secondary" disabled>
                  Esgotado
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
