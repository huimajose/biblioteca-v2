import React, { useState, useEffect } from 'react';
import { Printer, Ticket, X, ListFilter, History, Package, RotateCcw, AlertTriangle, Users, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { cn } from '@/utils/cn.ts';
import { motion, AnimatePresence } from 'motion/react';
import { BorrowTicket } from '@/components/BorrowTicket.tsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const ReportsPage = () => {
  const [reportType, setReportType] = useState<'activity' | 'genre' | 'inventory' | 'users' | 'top-books'>('activity');
  const [activities, setActivities] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [userReports, setUserReports] = useState<any[]>([]);
  const [topBooks, setTopBooks] = useState<any[]>([]);
  const [dates, setDates] = useState({ start: '', end: '' });
  const [statusFilter, setStatusFilter] = useState<'all' | 'borrowed' | 'returned' | 'pending' | 'rejected'>('all');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [confirmReturn, setConfirmReturn] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [filtering, setFiltering] = useState(false);

  useEffect(() => {
    if (reportType === 'genre' || reportType === 'inventory') {
      fetch('/api/books').then(res => res.json()).then(setBooks);
    }
    if (reportType === 'activity') {
      fetchReport();
    }
    if (reportType === 'users') {
      fetch('/api/admin/reports/users').then(res => res.json()).then(setUserReports);
    }
    if (reportType === 'top-books') {
      fetch('/api/admin/reports/top-books')
        .then(res => res.json())
        .then(setTopBooks);
    }
  }, [reportType]);

  useEffect(() => {
    if (reportType !== 'activity') return;
    const timer = setTimeout(() => {
      fetchReport();
    }, 200);
    return () => clearTimeout(timer);
  }, [reportType, dates.start, dates.end, statusFilter]);

  const fetchReport = async () => {
    const params = new URLSearchParams(dates);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    const query = params.toString();
    setFiltering(true);
    try {
      const res = await fetch(`/api/admin/reports/activity?${query}`);
      setActivities(await res.json());
    } finally {
      setFiltering(false);
    }
  };

  const applyQuickRange = (range: 'today' | 'week' | 'month' | '30d') => {
    const now = new Date();
    const end = now.toISOString().slice(0, 10);
    let startDate = new Date(now);
    if (range === 'today') {
      startDate = new Date(now);
    } else if (range === 'week') {
      startDate.setDate(startDate.getDate() - 6);
    } else if (range === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate.setDate(startDate.getDate() - 29);
    }
    const start = startDate.toISOString().slice(0, 10);
    setDates({ start, end });
  };

  const exportActivityPdf = () => {
    const doc = new jsPDF('p', 'pt');
    doc.setFontSize(16);
    doc.text('Relatorio de atividade da biblioteca', 40, 40);
    doc.setFontSize(10);
    doc.text(`Intervalo: ${dates.start || 'Todos'} - ${dates.end || 'Todos'}`, 40, 58);
    doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, 40, 72);

    const rows = activities.map((act) => {
      const statusLabel =
        act.status === 'borrowed' ? 'emprestado' :
        act.status === 'returned' ? 'devolvido' :
        act.status === 'pending' ? 'pendente' :
        act.status;
      return [
        new Date(act.borrowedDate).toLocaleDateString(),
        act.userName || act.userEmail || 'N/D',
        act.bookTitle,
        String(act.physicalBookId ?? ''),
        statusLabel,
      ];
    });

    autoTable(doc, {
      startY: 90,
      head: [['Data', 'Utilizador', 'Livro', 'ID fisico', 'Estado']],
      body: rows.length ? rows : [['-', '-', '-', '-', '-']],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [101, 163, 13] },
    });

    doc.save('relatorio-atividade.pdf');
  };

  const exportTopBooksPdf = () => {
    const doc = new jsPDF('p', 'pt');
    doc.setFontSize(16);
    doc.text('Relatorio de livros mais requisitados', 40, 40);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, 40, 58);

    const rows = (topBooks || []).map((b: any, index: number) => ([
      String(index + 1),
      b.title || 'N/D',
      b.author || 'N/D',
      b.isbn || 'N/D',
      String(b.totalBorrows ?? 0),
    ]));

    autoTable(doc, {
      startY: 80,
      head: [['#', 'Titulo', 'Autor', 'ISBN', 'Requisicoes']],
      body: rows.length ? rows : [['-', '-', '-', '-', '-']],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [101, 163, 13] },
    });

    doc.save('relatorio-livros-mais-requisitados.pdf');
  };

  const handleReturn = async () => {
    if (!confirmReturn) return;
    setLoading(true);
    try {
      const res = await fetch('/api/transactions/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: confirmReturn.tid })
      });
      if (res.ok) {
        fetchReport();
        setConfirmReturn(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const booksByGenre = books.reduce((acc: any, book: any) => {
    const genre = book.genre || 'Sem categoria';
    if (!acc[genre]) acc[genre] = [];
    acc[genre].push(book);
    return acc;
  }, {});

  const inventoryStats = {
    totalBooks: books.length,
    physicalBooks: books.filter(b => !b.isDigital).length,
    digitalBooks: books.filter(b => b.isDigital).length,
    outOfStock: books.filter(b => !b.isDigital && b.availableCopies === 0).length,
    lowStock: books.filter(b => !b.isDigital && b.availableCopies > 0 && b.availableCopies < 2).length,
    totalCopies: books.reduce((acc, b) => acc + (b.totalCopies || 0), 0),
    availableCopies: books.reduce((acc, b) => acc + (b.availableCopies || 0), 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 print:hidden">
        <button 
          onClick={() => setReportType('activity')}
          className={cn(
            "px-6 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2",
            reportType === 'activity' ? "bg-lime-600 text-white shadow-lg" : "bg-white text-gray-500 hover:bg-gray-50"
          )}
        >
          <History className="w-4 h-4" /> Atividade
        </button>
        <button 
          onClick={() => setReportType('genre')}
          className={cn(
            "px-6 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2",
            reportType === 'genre' ? "bg-lime-600 text-white shadow-lg" : "bg-white text-gray-500 hover:bg-gray-50"
          )}
        >
          <ListFilter className="w-4 h-4" /> Por curso
        </button>
        <button 
          onClick={() => setReportType('inventory')}
          className={cn(
            "px-6 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2",
            reportType === 'inventory' ? "bg-lime-600 text-white shadow-lg" : "bg-white text-gray-500 hover:bg-gray-50"
          )}
        >
          <Package className="w-4 h-4" /> Estado do stock
        </button>
        <button 
          onClick={() => setReportType('users')}
          className={cn(
            "px-6 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2",
            reportType === 'users' ? "bg-lime-600 text-white shadow-lg" : "bg-white text-gray-500 hover:bg-gray-50"
          )}
        >
          <Users className="w-4 h-4" /> Utilizadores e emprestimos
        </button>
        <button 
          onClick={() => setReportType('top-books')}
          className={cn(
            "px-6 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2",
            reportType === 'top-books' ? "bg-lime-600 text-white shadow-lg" : "bg-white text-gray-500 hover:bg-gray-50"
          )}
        >
          <TrendingUp className="w-4 h-4" /> Mais requisitados
        </button>
      </div>

      {reportType === 'activity' && (
        <>
          <Card className="p-6 print:hidden">
            <h2 className="text-xl font-bold mb-4">Relatorios de atividade</h2>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm font-medium mb-1">Data de inicio</label>
                <input type="date" className="px-4 py-2 border rounded-lg" value={dates.start} onChange={e => setDates({...dates, start: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Data de fim</label>
                <input type="date" className="px-4 py-2 border rounded-lg" value={dates.end} onChange={e => setDates({...dates, end: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Estado</label>
                <select
                  className="px-4 py-2 border rounded-lg"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="all">Todos</option>
                  <option value="borrowed">Emprestado</option>
                  <option value="returned">Devolvido</option>
                  <option value="pending">Pendente</option>
                  <option value="rejected">Rejeitado</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => applyQuickRange('today')}>Hoje</Button>
                <Button variant="secondary" onClick={() => applyQuickRange('week')}>Esta semana</Button>
                <Button variant="secondary" onClick={() => applyQuickRange('month')}>Este mes</Button>
                <Button variant="secondary" onClick={() => applyQuickRange('30d')}>Ultimos 30 dias</Button>
              </div>
              <Button onClick={fetchReport}>Filtrar atividades</Button>
              <Button variant="secondary" onClick={exportActivityPdf} className="flex items-center gap-2">
                <Printer className="w-4 h-4" /> Baixar PDF
              </Button>
              {filtering && (
                <span className="text-xs text-gray-400">A filtrar...</span>
              )}
            </div>
          </Card>

          <Card className="overflow-hidden print:border-none print:shadow-none">
            <div className="p-6 border-b border-gray-100 hidden print:block">
              <h1 className="text-2xl font-bold">Relatorio de atividade da biblioteca</h1>
              <p className="text-sm text-gray-500">Intervalo: {dates.start || 'Todos'} - {dates.end || 'Todos'}</p>
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-bottom border-gray-100">
                <tr>
                  <th className="p-4 font-semibold text-sm">Data</th>
                  <th className="p-4 font-semibold text-sm">Utilizador</th>
                  <th className="p-4 font-semibold text-sm">Livro</th>
                  <th className="p-4 font-semibold text-sm">Estado</th>
                  <th className="p-4 font-semibold text-sm print:hidden">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activities.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <History className="w-8 h-8 opacity-20" />
                        <p className="text-sm font-medium italic">Nao foram encontradas atividades para o intervalo selecionado.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  activities.map(act => (
                    <tr key={act.tid} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 text-sm">{new Date(act.borrowedDate).toLocaleDateString()}</td>
                      <td className="p-4 text-sm font-medium">{act.userName || act.userEmail || 'N/D'}</td>
                      <td className="p-4 text-sm">
                        <p className="font-bold">{act.bookTitle}</p>
                        <p className="text-[10px] text-gray-400 uppercase">ID: {act.physicalBookId}</p>
                      </td>
                      <td className="p-4">
                        {(() => {
                          const statusLabel =
                            act.status === 'borrowed' ? 'emprestado' :
                            act.status === 'returned' ? 'devolvido' :
                            act.status === 'pending' ? 'pendente' :
                            act.status;
                          return (
                            <span className={cn(
                              "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                              act.status === 'pending'
                                ? "bg-amber-100 text-amber-700"
                                : act.status === 'borrowed'
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-green-100 text-green-700"
                            )}>
                              {statusLabel}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="p-4 print:hidden">
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setSelectedTicket(act)}
                            className="p-2 text-lime-600 hover:bg-lime-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                            title="Ver talao"
                          >
                            <Ticket className="w-4 h-4" />
                          </button>
                          {act.status === 'borrowed' && (
                            <button 
                              onClick={() => setConfirmReturn(act)}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                              title="Devolver livro"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {reportType === 'genre' && (
        <>
          <Card className="p-6 print:hidden flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">Inventario por curso</h2>
              <p className="text-sm text-gray-500">Listagem de todos os livros agrupados por categoria.</p>
            </div>
            <Button variant="secondary" onClick={() => window.print()} className="flex items-center gap-2">
              <Printer className="w-4 h-4" /> Imprimir inventario
            </Button>
          </Card>

          <div className="space-y-8 print:space-y-4">
            {Object.keys(booksByGenre).length === 0 ? (
              <Card className="p-20 text-center flex flex-col items-center gap-4 text-gray-400">
                <ListFilter className="w-12 h-12 opacity-10" />
                <p className="text-lg font-medium italic">Nao foram encontrados livros no inventario.</p>
              </Card>
            ) : (
              Object.entries(booksByGenre).map(([genre, genreBooks]: [string, any]) => (
                <div key={genre}>
                  <Card className="overflow-hidden print:border-none print:shadow-none">
                    <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                      <h3 className="font-bold text-lime-600 uppercase tracking-wider text-sm">{genre}</h3>
                      <span className="text-xs font-bold bg-white px-2 py-1 rounded-lg border border-gray-200">{genreBooks.length} Livros</span>
                    </div>
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-white border-b border-gray-100">
                        <tr>
                          <th className="p-4 font-semibold text-xs uppercase text-gray-400">Titulo</th>
                          <th className="p-4 font-semibold text-xs uppercase text-gray-400">Autor</th>
                          <th className="p-4 font-semibold text-xs uppercase text-gray-400">ISBN</th>
                          <th className="p-4 font-semibold text-xs uppercase text-gray-400 text-right">Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {genreBooks.map((book: any) => (
                          <tr key={book.id} className="hover:bg-gray-50 transition-colors">
                            <td className="p-4 text-sm font-bold">{book.title}</td>
                            <td className="p-4 text-sm text-gray-600">{book.author}</td>
                            <td className="p-4 text-xs font-mono text-gray-400">{book.isbn}</td>
                            <td className="p-4 text-sm text-right font-bold">
                              {book.isDigital ? (
                                <span className="text-purple-600 uppercase text-[10px]">Digital</span>
                              ) : (
                                <span className={cn(book.availableCopies > 0 ? "text-green-600" : "text-red-600")}>
                                  {book.availableCopies}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {reportType === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:grid-cols-4">
            <Card className="p-4 bg-lime-50 border-lime-100">
              <p className="text-[10px] font-bold text-lime-400 uppercase tracking-widest mb-1">Total de titulos</p>
              <p className="text-2xl font-black text-lime-700">{inventoryStats.totalBooks}</p>
              <p className="text-[10px] text-lime-400 mt-1">{inventoryStats.physicalBooks} Fisicos / {inventoryStats.digitalBooks} Digitais</p>
            </Card>
            <Card className="p-4 bg-emerald-50 border-emerald-100">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Total de exemplares</p>
              <p className="text-2xl font-black text-emerald-700">{inventoryStats.totalCopies}</p>
              <p className="text-[10px] text-emerald-400 mt-1">{inventoryStats.availableCopies} Disponiveis para requisicao</p>
            </Card>
            <Card className="p-4 bg-red-50 border-red-100">
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Esgotado</p>
              <p className="text-2xl font-black text-red-700">{inventoryStats.outOfStock}</p>
              <p className="text-[10px] text-red-400 mt-1">Titulos sem exemplares disponiveis</p>
            </Card>
            <Card className="p-4 bg-amber-50 border-amber-100">
              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">Stock baixo</p>
              <p className="text-2xl font-black text-amber-700">{inventoryStats.lowStock}</p>
              <p className="text-[10px] text-amber-400 mt-1">Titulos com apenas 1 exemplar</p>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center print:hidden">
              <h2 className="text-xl font-bold">Estado completo do inventario</h2>
              <Button variant="secondary" onClick={() => window.print()} className="flex items-center gap-2">
                <Printer className="w-4 h-4" /> Imprimir inventario
              </Button>
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400">Detalhes do livro</th>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400">ISBN</th>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400">Tipo</th>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400 text-right">Disponibilidade</th>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {books.map(book => (
                  <tr key={book.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <p className="text-sm font-bold">{book.title}</p>
                      <p className="text-xs text-gray-500">{book.author}</p>
                    </td>
                    <td className="p-4 text-xs font-mono text-gray-400">{book.isbn}</td>
                    <td className="p-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[9px] font-bold uppercase",
                        book.isDigital ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                      )}>
                        {book.isDigital ? 'Digital' : 'Fisico'}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-right font-mono">
                      {book.isDigital ? '-' : `${book.availableCopies}`}
                    </td>
                    <td className="p-4 text-right">
                      {!book.isDigital && (
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                          book.availableCopies === 0 ? "bg-red-100 text-red-700" : 
                          book.availableCopies === 1 ? "bg-amber-100 text-amber-700" : 
                          "bg-green-100 text-green-700"
                        )}>
                          {book.availableCopies === 0 ? 'Esgotado' : 
                           book.availableCopies === 1 ? 'Stock baixo' : 'Em stock'}
                        </span>
                      )}
                      {book.isDigital && (
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-lime-100 text-lime-700">
                          Sempre disponivel
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {reportType === 'users' && (
        <div className="space-y-6">
          <Card className="p-6 print:hidden flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">Diretorio de utilizadores e emprestimos ativos</h2>
              <p className="text-sm text-gray-500">Lista completa de todos os utilizadores registados e dos itens atualmente requisitados.</p>
            </div>
            <Button variant="secondary" onClick={() => window.print()} className="flex items-center gap-2">
              <Printer className="w-4 h-4" /> Imprimir relatorio de utilizadores
            </Button>
          </Card>

          <Card className="overflow-hidden print:border-none print:shadow-none">
            <div className="p-6 border-b border-gray-100 hidden print:block">
              <h1 className="text-2xl font-bold">Relatorio de utilizadores da biblioteca</h1>
              <p className="text-sm text-gray-500">Gerado em {new Date().toLocaleDateString()}</p>
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400">Informacao do utilizador</th>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400">Estado</th>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400">Registado em</th>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400">Emprestimos ativos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {userReports.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-20 text-center">
                      <div className="flex flex-col items-center gap-4 text-gray-400">
                        <Users className="w-12 h-12 opacity-10" />
                        <p className="text-lg font-medium italic">Nao foram encontrados utilizadores registados.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  userReports.map(user => (
                    <tr key={user.clerkId} className="hover:bg-gray-50 transition-colors align-top">
                      <td className="p-4">
                        <p className="text-sm font-bold">{user.fullName || user.primaryEmail}</p>
                        <p className="text-[10px] text-gray-400">{user.primaryEmail}</p>
                        <p className="text-[10px] text-gray-400 font-mono uppercase">ID: {user.clerkId}</p>
                      </td>
                      <td className="p-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                          user.status === 'active' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        )}>
                          {user.status === 'active' ? 'ativo' : user.status}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        {user.activeBorrows.length === 0 ? (
                          <span className="text-xs text-gray-400 italic">Sem emprestimos ativos</span>
                        ) : (
                          <div className="space-y-2">
                            {user.activeBorrows.map((borrow: any) => (
                              <div key={borrow.tid} className="bg-lime-50/50 p-2 rounded-lg border border-lime-100/50">
                                <p className="text-xs font-bold text-lime-900">{borrow.bookTitle}</p>
                                <div className="flex justify-between items-center mt-1">
                                  <span className="text-[9px] text-lime-400 font-mono">PID: {borrow.physicalBookId}</span>
                                  <span className="text-[9px] text-lime-400">{new Date(borrow.borrowedDate).toLocaleDateString()}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {reportType === 'top-books' && (
        <div className="space-y-6">
          <Card className="p-6 print:hidden flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">Livros mais requisitados</h2>
              <p className="text-sm text-gray-500">Ranking dos titulos com mais requisicoes.</p>
            </div>
            <Button variant="secondary" onClick={exportTopBooksPdf} className="flex items-center gap-2">
              <Printer className="w-4 h-4" /> Baixar PDF
            </Button>
          </Card>

          <Card className="overflow-hidden print:border-none print:shadow-none">
            <div className="p-6 border-b border-gray-100 hidden print:block">
              <h1 className="text-2xl font-bold">Relatorio de livros mais requisitados</h1>
              <p className="text-sm text-gray-500">Gerado em {new Date().toLocaleDateString()}</p>
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400">#</th>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400">Titulo</th>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400">Autor</th>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400">ISBN</th>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400 text-right">Requisicoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topBooks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <TrendingUp className="w-8 h-8 opacity-20" />
                        <p className="text-sm font-medium italic">Ainda nao ha dados suficientes para o ranking.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  topBooks.map((b: any, index: number) => (
                    <tr key={`${b.bookId}-${index}`} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 text-sm font-bold">{index + 1}</td>
                      <td className="p-4 text-sm font-semibold">{b.title}</td>
                      <td className="p-4 text-sm text-gray-600">{b.author}</td>
                      <td className="p-4 text-xs font-mono text-gray-400">{b.isbn}</td>
                      <td className="p-4 text-sm text-right font-bold">{b.totalBorrows}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      <AnimatePresence>
        {selectedTicket && (
          <BorrowTicket activity={selectedTicket} onClose={() => setSelectedTicket(null)} />
        )}
        
        {confirmReturn && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center gap-3 text-amber-600">
                <div className="p-2 bg-amber-50 rounded-lg">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold">Confirmar devolucao</h3>
              </div>
              
              <div className="p-6 space-y-4">
                <p className="text-gray-600">Tem a certeza de que quer marcar este livro como devolvido? Isto ira atualizar o inventario e notificar reservas pendentes.</p>
                
                <div className="bg-gray-50 p-4 rounded-xl space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400 uppercase font-bold">Livro</span>
                    <span className="font-bold">{confirmReturn.bookTitle}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400 uppercase font-bold">Utilizador</span>
                    <span className="font-bold">{confirmReturn.userName || confirmReturn.userEmail || confirmReturn.userId}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400 uppercase font-bold">ID fisico</span>
                    <span className="font-mono">{confirmReturn.physicalBookId}</span>
                  </div>
                </div>
              </div>
              
              <div className="p-6 bg-gray-50 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setConfirmReturn(null)} disabled={loading}>
                  Cancelar
                </Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleReturn} disabled={loading}>
                  {loading ? 'A processar...' : 'Confirmar devolucao'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
