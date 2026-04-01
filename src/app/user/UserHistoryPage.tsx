import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card.tsx';
import { User } from '@/hooks/useAuth.ts';
import { cn } from '@/utils/cn.ts';
import { BookDetailsModal } from '@/components/BookDetailsModal.tsx';
import { useNavigate } from 'react-router-dom';
import { resolveBookFileUrl } from '@/utils/file.ts';

interface UserHistoryPageProps {
  user: User;
}

export const UserHistoryPage = ({ user }: UserHistoryPageProps) => {
  const [history, setHistory] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<any | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/user/history', {
      headers: { 'x-user-id': user.id },
    })
      .then(res => res.json())
      .then(data => setHistory(Array.isArray(data) ? data : data?.data ?? []));
  }, [user.id]);

  const totalPages = Math.max(1, Math.ceil(history.length / pageSize));
  const paged = history.slice((page - 1) * pageSize, page * pageSize);

  const resolveFileUrl = (fileUrl?: string | null, bookId?: number) =>
    resolveBookFileUrl(fileUrl, bookId);

  const openReader = (book: any) => {
    if (!book?.fileUrl) return;
    navigate(`/reader/${book.id}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">O Meu Historico</h1>
        <p className="text-sm text-gray-500">Requisicoes e devolucoes anteriores.</p>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-4 text-xs uppercase text-gray-400">Livro</th>
              <th className="p-4 text-xs uppercase text-gray-400">Data</th>
              <th className="p-4 text-xs uppercase text-gray-400">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-10 text-center text-sm text-gray-400">
                  Sem historico disponivel.
                </td>
              </tr>
            ) : (
              paged.map((h) => (
                <tr key={h.tid} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(h.book)}>
                  <td className="p-4 text-sm">
                    <p className="font-semibold">{h.bookTitle}</p>
                    <p className="text-xs text-gray-500">{h.bookAuthor}</p>
                  </td>
                  <td className="p-4 text-sm">
                    {h.borrowedDate ? new Date(h.borrowedDate).toLocaleDateString() : 'N/D'}
                  </td>
                  <td className="p-4">
                    <span className={cn(
                      'px-2 py-1 rounded-full text-[10px] font-bold uppercase',
                      h.status === 'borrowed' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                    )}>
                      {h.status === 'borrowed' ? 'emprestado' : 'devolvido'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>Pagina {page} de {totalPages}</span>
        <div className="flex items-center gap-2">
          <select className="px-3 py-1 border rounded-lg" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            {[10, 20, 30].map(size => (
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
