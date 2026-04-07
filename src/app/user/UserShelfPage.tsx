import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card.tsx';
import { BookOpen, Star } from 'lucide-react';
import { DEFAULT_BOOK_COVER } from '@/constants.ts';
import { User } from '@/hooks/useAuth.ts';
import { BookDetailsModal } from '@/components/BookDetailsModal.tsx';
import { useNavigate } from 'react-router-dom';
import { resolveBookFileUrl } from '@/utils/file.ts';

interface UserShelfPageProps {
  user: User;
}

export const UserShelfPage = ({ user }: UserShelfPageProps) => {
  const [shelf, setShelf] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [selected, setSelected] = useState<any | null>(null);
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');
  const [favoriteLoading, setFavoriteLoading] = useState<Record<number, boolean>>({});
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/user/shelf', {
      headers: { 'x-user-id': user.id },
    })
      .then(res => res.json())
      .then(data => setShelf(Array.isArray(data) ? data : data?.data ?? []));
  }, [user.id]);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  const filteredShelf = shelf.filter((entry) => filter === 'favorites' ? Boolean(entry.favorite) : true);
  const totalPages = Math.max(1, Math.ceil(filteredShelf.length / pageSize));
  const paged = filteredShelf.slice((page - 1) * pageSize, page * pageSize);

  const resolveFileUrl = (fileUrl?: string | null, bookId?: number) =>
    resolveBookFileUrl(fileUrl, bookId);

  const openReader = (book: any) => {
    if (!book?.fileUrl) return;
    navigate(`/reader/${book.id}`);
  };

  const toggleFavorite = async (bookId: number) => {
    if (favoriteLoading[bookId]) return;
    const current = shelf.find((entry) => entry?.book?.id === bookId);
    if (!current) return;

    setFavoriteLoading((prev) => ({ ...prev, [bookId]: true }));
    try {
      const res = await fetch(`/api/books/${bookId}/favorite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({ favorite: !Boolean(current.favorite) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;

      setShelf((prev) =>
        [...prev]
          .map((entry) =>
            entry?.book?.id === bookId
              ? { ...entry, favorite: Boolean(data?.favorite) }
              : entry
          )
          .sort((a, b) => {
            const favoriteOrder = Number(Boolean(b.favorite)) - Number(Boolean(a.favorite));
            if (favoriteOrder !== 0) return favoriteOrder;
            return new Date(b.addedAt || 0).getTime() - new Date(a.addedAt || 0).getTime();
          })
      );
    } finally {
      setFavoriteLoading((prev) => ({ ...prev, [bookId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">A Minha Estante</h1>
        <p className="text-sm text-gray-500">Livros digitais adicionados para leitura.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className={`px-3 py-1 rounded-full text-xs font-bold ${filter === 'all' ? 'bg-lime-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
          onClick={() => setFilter('all')}
        >
          Todos
        </button>
        <button
          className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${filter === 'favorites' ? 'bg-amber-500 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
          onClick={() => setFilter('favorites')}
        >
          <Star className="w-3 h-3" />
          Favoritos
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {paged.length === 0 ? (
          <Card className="p-10 text-center text-gray-400">
            {filter === 'favorites' ? 'Sem favoritos na estante.' : 'Sem livros na estante.'}
          </Card>
        ) : (
          paged.map((entry) => (
            <Card key={entry.id} className="p-4 flex gap-4 items-center cursor-pointer" onClick={() => setSelected(entry.book)}>
              <img
                src={entry.book.cover || DEFAULT_BOOK_COVER}
                alt={entry.book.title}
                className="w-16 h-24 rounded-lg object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{entry.book.title}</p>
                  <button
                    className={`shrink-0 rounded-full p-2 transition-colors ${entry.favorite ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400 hover:text-amber-500'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(entry.book.id);
                    }}
                    disabled={favoriteLoading[entry.book.id]}
                    title={entry.favorite ? 'Remover dos favoritos' : 'Marcar como favorito'}
                  >
                    <Star className={`w-4 h-4 ${entry.favorite ? 'fill-current' : ''}`} />
                  </button>
                </div>
                <p className="text-sm text-gray-500">{entry.book.author}</p>
                {entry.favorite && (
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-amber-600">Favorito</p>
                )}
                {resolveFileUrl(entry.book.fileUrl, entry.book.id) && (
                  <button
                    className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-lime-700"
                    onClick={(e) => { e.stopPropagation(); openReader(entry.book); }}
                  >
                    <BookOpen className="w-3 h-3" />
                    Ler PDF
                  </button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>Pagina {page} de {totalPages}</span>
        <div className="flex items-center gap-2">
          <select className="px-3 py-1 border rounded-lg" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            {[6, 9, 12, 18].map(size => (
              <option key={size} value={size}>{size} por pagina</option>
            ))}
          </select>
          <button className="px-3 py-1 border rounded-lg" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Anterior</button>
          <button className="px-3 py-1 border rounded-lg" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Seguinte</button>
        </div>
      </div>

      {selected && (
        <BookDetailsModal
          book={selected}
          onClose={() => setSelected(null)}
          onBorrow={() => {}}
          onReserve={() => {}}
          onAddToShelf={() => {}}
          onToggleFavorite={toggleFavorite}
          favoriteActive={Boolean(shelf.find((entry) => entry?.book?.id === selected?.id)?.favorite)}
          favoriteLoading={Boolean(favoriteLoading[selected?.id])}
          resolveFileUrl={(fileUrl) => resolveFileUrl(fileUrl, selected?.id)}
          onReadPdf={openReader}
        />
      )}
    </div>
  );
};
