import React, { useEffect, useState } from 'react';
import { RotateCcw, Printer } from 'lucide-react';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { cn } from '@/utils/cn.ts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LOGO_WATERMARK } from '@/constants.ts';
import { addCenteredWatermarkToAllPages, loadWatermarkImage } from '@/utils/pdfWatermark.ts';

export const TransactionsPage = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'borrowed' | 'returned' | 'rejected'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const fetchTransactions = async () => {
    const query = new URLSearchParams();
    if (startDate) query.set('start', startDate);
    if (endDate) query.set('end', endDate);
    query.set('includePending', 'true');
    const res = await fetch(`/api/admin/reports/activity?${query.toString()}`);
    const data = await res.json();
    setTransactions(Array.isArray(data) ? data : data?.data ?? []);
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const pending = transactions.filter((t) => (t.status || '').toLowerCase() === 'pending');
  const history = transactions.filter((t) => (t.status || '').toLowerCase() !== 'pending');

  const filtered = history.filter((t) => {
    if (statusFilter === 'all') return true;
    return (t.status || '').toLowerCase() === statusFilter;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const exportTransactionsPdf = async () => {
    const doc = new jsPDF('p', 'pt');
    doc.setFontSize(16);
    doc.text('Relatorio de transacoes', 40, 40);
    doc.setFontSize(10);
    doc.text(`Intervalo: ${startDate || 'Todos'} - ${endDate || 'Todos'}`, 40, 58);
    doc.text(`Estado: ${statusFilter === 'all' ? 'Todos' : statusFilter}`, 40, 72);

    const rows = filtered.map((t) => {
      const status = (t.status || '').toLowerCase();
      const statusLabel =
        status === 'borrowed' ? 'emprestado' :
        status === 'returned' ? 'devolvido' :
        status === 'rejected' ? 'rejeitado' :
        status;
      return [
        t.borrowedDate ? new Date(t.borrowedDate).toLocaleDateString() : 'N/D',
        t.userName || t.userId || 'N/D',
        t.bookTitle || 'N/D',
        statusLabel,
      ];
    });

    autoTable(doc, {
      startY: 90,
      head: [['Data', 'Utilizador', 'Livro', 'Estado']],
      body: rows.length ? rows : [['-', '-', '-', '-']],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [101, 163, 13] },
    });

    try {
      const logo = await loadWatermarkImage(LOGO_WATERMARK);
      addCenteredWatermarkToAllPages(doc, logo, { width: 160 });
    } catch {
      // ignore watermark if logo fails
    }

    doc.save('transacoes.pdf');
  };

  const handleReturn = async (tid: number) => {
    setLoading(true);
    try {
      const res = await fetch('/api/transactions/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: tid }),
      });
      if (res.ok) {
        fetchTransactions();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (tid: number, userId: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/transactions/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tid, userId }),
      });
      if (res.ok) fetchTransactions();
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (tid: number, userId: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/transactions/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tid, userId }),
      });
      if (res.ok) fetchTransactions();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Emprestimos e devolucoes</h1>
        <p className="text-sm text-gray-500">Gestao de transacoes de livros.</p>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="text-xs uppercase text-gray-400">Data inicio</label>
            <input className="w-full px-4 py-2 border rounded-lg" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs uppercase text-gray-400">Data fim</label>
            <input className="w-full px-4 py-2 border rounded-lg" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs uppercase text-gray-400">Estado</label>
            <select className="w-full px-4 py-2 border rounded-lg" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
              <option value="all">Todos</option>
              <option value="borrowed">Emprestado</option>
              <option value="returned">Devolvido</option>
              <option value="rejected">Rejeitado</option>
            </select>
          </div>
          <div>
            <Button className="w-full" onClick={fetchTransactions}>Filtrar</Button>
          </div>
          <div>
            <Button variant="secondary" className="w-full flex items-center justify-center gap-2" onClick={exportTransactionsPdf}>
              <Printer className="w-4 h-4" /> Imprimir PDF
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-amber-50/40">
          <h2 className="text-sm font-bold text-amber-700 uppercase tracking-wider">Pedidos pendentes</h2>
          <p className="text-xs text-amber-600">Aprovar ou rejeitar requisicoes antes de entrar no historico.</p>
        </div>
        <table className="w-full text-left border-collapse">
          <thead className="bg-amber-50 border-b border-amber-100">
            <tr>
              <th className="p-4 text-xs uppercase text-amber-700">Data</th>
              <th className="p-4 text-xs uppercase text-amber-700">Utilizador</th>
              <th className="p-4 text-xs uppercase text-amber-700">Livro</th>
              <th className="p-4 text-xs uppercase text-amber-700 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-50">
            {pending.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-sm text-gray-400">
                  Sem pedidos pendentes.
                </td>
              </tr>
            ) : (
              pending.map((t) => (
                <tr key={t.tid} className="hover:bg-amber-50/40">
                  <td className="p-4 text-sm">{t.borrowedDate ? new Date(t.borrowedDate).toLocaleDateString() : 'N/D'}</td>
                  <td className="p-4 text-sm font-medium">{t.userName || t.userId}</td>
                  <td className="p-4 text-sm">
                    <p className="font-semibold">{t.bookTitle}</p>
                    <p className="text-[10px] text-gray-400 uppercase">ID: {t.physicalBookId || '-'}</p>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="secondary"
                        className="inline-flex items-center gap-2"
                        onClick={() => handleApprove(t.tid, t.userId)}
                        disabled={loading}
                      >
                        Aprovar
                      </Button>
                      <Button
                        variant="secondary"
                        className="inline-flex items-center gap-2"
                        onClick={() => handleReject(t.tid, t.userId)}
                        disabled={loading}
                      >
                        Rejeitar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wider">Historico de transacoes</h2>
          <p className="text-xs text-gray-500">Emprestimos aprovados, devolvidos e rejeitados.</p>
        </div>
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-4 text-xs uppercase text-gray-400">Data</th>
              <th className="p-4 text-xs uppercase text-gray-400">Utilizador</th>
              <th className="p-4 text-xs uppercase text-gray-400">Livro</th>
              <th className="p-4 text-xs uppercase text-gray-400">Estado</th>
              <th className="p-4 text-xs uppercase text-gray-400 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-10 text-center text-sm text-gray-400">
                  Nenhuma transacao encontrada.
                </td>
              </tr>
            ) : (
              paged.map((t) => {
                const status = (t.status || '').toLowerCase();
                return (
                  <tr key={t.tid} className="hover:bg-gray-50">
                    <td className="p-4 text-sm">{t.borrowedDate ? new Date(t.borrowedDate).toLocaleDateString() : 'N/D'}</td>
                    <td className="p-4 text-sm font-medium">{t.userName || t.userId}</td>
                    <td className="p-4 text-sm">
                      <p className="font-semibold">{t.bookTitle}</p>
                      <p className="text-[10px] text-gray-400 uppercase">ID: {t.physicalBookId}</p>
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        'px-2 py-1 rounded-full text-[10px] font-bold uppercase',
                        status === 'borrowed'
                          ? 'bg-orange-100 text-orange-700'
                          : status === 'returned'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                      )}>
                        {status === 'borrowed' ? 'emprestado' : status === 'returned' ? 'devolvido' : 'rejeitado'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                    {status === 'borrowed' && (
                      <Button
                        variant="secondary"
                        className="inline-flex items-center gap-2"
                        onClick={() => handleReturn(t.tid)}
                          disabled={loading}
                        >
                          <RotateCcw className="w-4 h-4" />
                          Devolver
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>Pagina {page} de {totalPages}</span>
        <div className="flex items-center gap-2">
          <select className="px-3 py-1 border rounded-lg" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            {[15, 30, 50].map(size => (
              <option key={size} value={size}>{size} por pagina</option>
            ))}
          </select>
          <button className="px-3 py-1 border rounded-lg" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Anterior</button>
          <button className="px-3 py-1 border rounded-lg" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Seguinte</button>
        </div>
      </div>
    </div>
  );
};
