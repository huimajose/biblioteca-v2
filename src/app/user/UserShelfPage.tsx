import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card.tsx';
import { BookOpen } from 'lucide-react';
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
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/user/shelf', {
      headers: { 'x-user-id': user.id },
    })
      .then(res => res.json())
      .then(data => setShelf(Array.isArray(data) ? data : data?.data ?? []));
  }, [user.id]);

  const totalPages = Math.max(1, Math.ceil(shelf.length / pageSize));
  const paged = shelf.slice((page - 1) * pageSize, page * pageSize);

  const resolveFileUrl = (fileUrl?: string | null, bookId?: number) =>
    resolveBookFileUrl(fileUrl, bookId);

  const openReader = (book: any) => {
    if (!book?.fileUrl) return;
    navigate(`/reader/${book.id}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">A Minha Estante</h1>
        <p className="text-sm text-gray-500">Livros digitais adicionados para leitura.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {paged.length === 0 ? (
          <Card className="p-10 text-center text-gray-400">Sem livros na estante.</Card>
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
                <p className="font-semibold">{entry.book.title}</p>
                <p className="text-sm text-gray-500">{entry.book.author}</p>
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
          resolveFileUrl={(fileUrl) => resolveFileUrl(fileUrl, selected?.id)}
          onReadPdf={openReader}
        />
      )}
    </div>
  );
};
