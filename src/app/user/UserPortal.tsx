import React, { useState, useEffect } from 'react';
import { Search, BookOpen, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card } from '@/components/ui/Card.tsx';
import { User } from '@/hooks/useAuth.ts';
import { cn } from '@/utils/cn.ts';
import { BorrowTicket } from '@/components/BorrowTicket.tsx';
import { BookLabel } from '@/components/BookLabel.tsx';
import { DEFAULT_BOOK_COVER } from '@/constants.ts';
import { StudentSticker } from '@/components/StudentSticker.tsx';
import { BookDetailsModal } from '@/components/BookDetailsModal.tsx';
import { useNavigate } from 'react-router-dom';
import { resolveBookFileUrl } from '@/utils/file.ts';
import { Toast } from '@/components/Toast.tsx';

interface UserPortalProps {
  user: User;
}

export const UserPortal = ({ user }: UserPortalProps) => {
  const [books, setBooks] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [ticket, setTicket] = useState<any>(null);
  const [selectedLabel, setSelectedLabel] = useState<any>(null);
  const [points, setPoints] = useState<number | null>(null);
  const [studentInfo, setStudentInfo] = useState<{ fullName?: string | null; studentNumber?: string | null; role?: string | null; status?: string | null }>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState<'all' | 'digital' | 'physical'>('all');
  const [filterAvailability, setFilterAvailability] = useState<'all' | 'available' | 'unavailable'>('all');
  const [genres, setGenres] = useState<any[]>([]);
  const [genreFilter, setGenreFilter] = useState<string>('all');
  const [shelfIds, setShelfIds] = useState<Set<number>>(new Set());
  const [activeBorrowMap, setActiveBorrowMap] = useState<Record<number, { tid: number; status: string }>>({});
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [borrowLoading, setBorrowLoading] = useState<Record<number, boolean>>({});
  const [reserveLoading, setReserveLoading] = useState<Record<number, boolean>>({});
  const [shelfLoading, setShelfLoading] = useState<Record<number, boolean>>({});
  const [toast, setToast] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    fetch('/api/books').then(res => res.json()).then(setBooks);
    fetch('/api/user/score', { headers: { 'x-user-id': user.id } })
      .then(res => res.json())
      .then(data => setPoints(data?.points ?? 100));
    fetch('/api/user/student-info', { headers: { 'x-user-id': user.id } })
      .then(res => res.json())
      .then(data => setStudentInfo({ fullName: data?.fullName, studentNumber: data?.studentNumber, role: data?.role, status: data?.status }));
    fetch('/api/user/shelf', { headers: { 'x-user-id': user.id } })
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : data?.data ?? [];
        const ids = new Set<number>(list.map((entry: any) => entry?.book?.id).filter(Boolean));
        setShelfIds(ids);
      })
      .catch(() => setShelfIds(new Set()));
    fetch('/api/user/borrow-status', { headers: { 'x-user-id': user.id } })
      .then(res => res.json())
      .then(data => setActiveBorrowMap(data?.byBookId ?? {}))
      .catch(() => setActiveBorrowMap({}));
    fetch('/api/genres')
      .then(res => res.json())
      .then(data => setGenres(Array.isArray(data) ? data : []))
      .catch(() => setGenres([]));

    fetch(`/api/books/recommendations?userId=${user.id}`)
      .then(res => res.json())
      .then(data => setRecommendations(Array.isArray(data) ? data : []))
      .catch(() => setRecommendations([]));
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && user?.id) {
      window.localStorage.setItem('userId', user.id);
    }
  }, [user?.id]);

  const notify = (title: string, message: string) => setToast({ title, message });

  const trackClick = (book: any) => {
    if (!book?.id) return;
    try {
      const raw = window.localStorage.getItem('recentBookClicks');
      const list = raw ? (JSON.parse(raw) as number[]) : [];
      const cleaned = Array.isArray(list) ? list.filter((v) => Number.isFinite(v)) : [];
      const next = [book.id, ...cleaned.filter((id) => id !== book.id)].slice(0, 15);
      window.localStorage.setItem('recentBookClicks', JSON.stringify(next));
    } catch {
      // ignore
    }
    fetch('/api/books/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId: book.id, userId: user.id }),
    }).catch(() => null);
  };

  const handleBorrow = async (bookId: number) => {
    if (borrowLoading[bookId]) return;
    const book = books.find((b) => b.id === bookId);
    const isDigital = Boolean(book?.fileUrl) || Boolean(book?.isDigital);
    if (isDigital && shelfIds.has(bookId)) {
      notify('Ja esta na estante', 'Este livro ja esta na sua estante digital.');
      return;
    }
    if (activeBorrowMap[bookId]) {
      const currentStatus = String(activeBorrowMap[bookId]?.status || '').toLowerCase();
      notify(
        'Pedido ja existente',
        currentStatus === 'borrowed'
          ? 'Este livro ja esta emprestado para si.'
          : 'Ja existe um pedido pendente para este livro.'
      );
      return;
    }
    setBorrowLoading((prev) => ({ ...prev, [bookId]: true }));
    try {
      const res = await fetch('/api/transactions/borrow', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': user.id
        },
        body: JSON.stringify({ bookId, userId: user.id })
      });
      const data = await res.json();
      if (res.ok) {
        if (data?.status === 'borrowed' && data?.tid) {
          setTicket(data);
          notify('Emprestimo aprovado', 'Livro requisitado com sucesso.');
        } else {
          notify('Pedido enviado', data?.message || 'Pedido enviado para aprovacao.');
        }
        setActiveBorrowMap((prev) => ({
          ...prev,
          [bookId]: {
            tid: Number(data?.tid || 0),
            status: String(data?.status || 'pending').toLowerCase(),
          },
        }));
        fetch('/api/books').then(res => res.json()).then(setBooks);
      } else {
        notify('Erro ao requisitar', data?.error || 'Nao foi possivel requisitar.');
      }
    } finally {
      setBorrowLoading((prev) => ({ ...prev, [bookId]: false }));
    }
  };

  const handleReserve = async (bookId: number) => {
    if (reserveLoading[bookId]) return;
    setReserveLoading((prev) => ({ ...prev, [bookId]: true }));
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': user.id
        },
        body: JSON.stringify({ bookId })
      });
      const data = await res.json();
      if (res.ok) {
        notify('Reserva criada', 'Reserva efetuada com sucesso! Vamos avisar quando estiver disponivel.');
      } else {
        notify('Erro ao reservar', data?.error || 'Nao foi possivel reservar.');
      }
    } finally {
      setReserveLoading((prev) => ({ ...prev, [bookId]: false }));
    }
  };

  const handleAddToShelf = async (bookId: number) => {
    if (shelfIds.has(bookId)) {
      notify('Ja esta na estante', 'Este livro ja se encontra na sua estante.');
      return;
    }
    if (shelfLoading[bookId]) return;
    setShelfLoading((prev) => ({ ...prev, [bookId]: true }));
    try {
      const res = await fetch(`/api/books/${bookId}/add-to-shelf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        notify('Erro ao adicionar', data?.message || 'Nao foi possivel adicionar.');
      } else {
        notify('Adicionado a estante', data?.message || 'Livro adicionado a estante.');
        setShelfIds((prev) => {
          const next = new Set(prev);
          next.add(bookId);
          return next;
        });
      }
    } finally {
      setShelfLoading((prev) => ({ ...prev, [bookId]: false }));
    }
  };

  const resolveFileUrl = (fileUrl?: string | null, bookId?: number) =>
    resolveBookFileUrl(fileUrl, bookId);

  const openReader = (book: any) => {
    if (!book?.fileUrl) return;
    navigate(`/reader/${book.id}`);
  };

  useEffect(() => {
    setPage(1);
  }, [search, filterType, filterAvailability, genreFilter]);

  const filteredBooks = books.filter(b => {
    const query = search.toLowerCase();
    const title = String(b.title || '').toLowerCase();
    const author = String(b.author || '').toLowerCase();
    const matchesSearch = title.includes(query) || author.includes(query);
    const isDigital = b.isDigital || Boolean(b.fileUrl);
    const matchesType =
      filterType === 'all' ||
      (filterType === 'digital' && isDigital) ||
      (filterType === 'physical' && !isDigital);
    const copies = b.availableCopies ?? 0;
    const matchesAvailability =
      filterAvailability === 'all' ||
      (filterAvailability === 'available' && copies > 0) ||
      (filterAvailability === 'unavailable' && copies <= 0);
    const matchesGenre = genreFilter === 'all' || b.genre === genreFilter;
    return matchesSearch && matchesType && matchesAvailability && matchesGenre;
  });

  const totalPages = Math.max(1, Math.ceil(filteredBooks.length / pageSize));
  const pagedBooks = filteredBooks.slice((page - 1) * pageSize, page * pageSize);

  const isBorrowing = (bookId: number) => Boolean(borrowLoading[bookId]);
  const isReserving = (bookId: number) => Boolean(reserveLoading[bookId]);
  const isAddingShelf = (bookId: number) => Boolean(shelfLoading[bookId]);
  const getBorrowStatus = (bookId: number) => String(activeBorrowMap[bookId]?.status || '').toLowerCase();
  const hasActiveBorrowRequest = (bookId: number) => Boolean(activeBorrowMap[bookId]);
  const getBorrowDisabledLabel = (bookId: number) =>
    getBorrowStatus(bookId) === 'borrowed' ? 'Ja emprestado' : 'Pedido pendente';

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Bem-vindo, leitor</h1>
          <p className="text-gray-500">
            Perfil: {user.isAdmin ? 'Administrador' : user.role === 'student' ? 'Estudante' : 'Externo'}.
            Explore a nossa colecao de {books.length} livros.
          </p>
        </div>
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
        
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Pesquisar por titulo ou autor..." 
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-lime-500 outline-none shadow-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button
          className={`px-3 py-1 rounded-full text-xs font-bold ${filterType === 'all' ? 'bg-lime-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
          onClick={() => setFilterType('all')}
        >
          Todos
        </button>
        <button
          className={`px-3 py-1 rounded-full text-xs font-bold ${filterType === 'digital' ? 'bg-lime-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
          onClick={() => setFilterType('digital')}
        >
          Digital
        </button>
        <button
          className={`px-3 py-1 rounded-full text-xs font-bold ${filterType === 'physical' ? 'bg-lime-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
          onClick={() => setFilterType('physical')}
        >
          Fisico
        </button>
        <button
          className={`px-3 py-1 rounded-full text-xs font-bold ${filterAvailability === 'available' ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
          onClick={() => setFilterAvailability(filterAvailability === 'available' ? 'all' : 'available')}
        >
          Disponivel
        </button>
        <button
          className={`px-3 py-1 rounded-full text-xs font-bold ${filterAvailability === 'unavailable' ? 'bg-orange-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
          onClick={() => setFilterAvailability(filterAvailability === 'unavailable' ? 'all' : 'unavailable')}
        >
          Esgotado
        </button>
        <select
          className="px-3 py-1 rounded-full text-xs font-bold border border-gray-200 text-gray-600 bg-white"
          value={genreFilter}
          onChange={(e) => { setGenreFilter(e.target.value); setPage(1); }}
        >
          <option value="all">Todos cursos</option>
          {genres.map((g) => (
            <option key={g.id} value={g.name}>{g.name}</option>
          ))}
        </select>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">Recomendados para si</h2>
            <p className="text-xs text-gray-400">Com base nos seus cliques e pedidos.</p>
          </div>
          <span className="text-[10px] uppercase text-lime-600 font-bold tracking-widest">Sugestoes</span>
        </div>
        {recommendations.length === 0 ? (
          <p className="text-sm text-gray-400">Sem recomendacoes neste momento.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recommendations.slice(0, 8).map((book) => (
              <div
                key={book.id}
                className="p-3 border border-gray-100 rounded-2xl hover:border-lime-200 hover:shadow-sm transition-all cursor-pointer"
                onClick={() => {
                  trackClick(book);
                  setSelectedBook(book);
                }}
              >
                <img
                  src={book.cover || DEFAULT_BOOK_COVER}
                  alt={book.title}
                  className="w-full h-36 object-cover rounded-xl mb-3"
                  referrerPolicy="no-referrer"
                />
                <p className="text-sm font-bold line-clamp-1">{book.title}</p>
                <p className="text-xs text-gray-500 line-clamp-1">{book.author}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {pagedBooks.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-2xl">
          {filterAvailability === 'available'
            ? 'Sem livros disponiveis no momento. Tente limpar os filtros ou volte mais tarde.'
            : 'Nenhum livro encontrado com os filtros atuais.'}
        </div>
      ) : (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {pagedBooks.map(book => (
          <motion.div 
            key={book.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -5 }}
          >
            <Card
              className="group cursor-pointer h-full flex flex-col"
              onClick={() => {
                trackClick(book);
                setSelectedBook(book);
              }}
            >
              <div className="aspect-[3/4] overflow-hidden relative bg-gray-100">
                <img 
                  src="/cover_2.jpeg" 
                  alt={book.title} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                  referrerPolicy="no-referrer" 
                />
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                  {book.fileUrl && book.availableCopies > 0 ? (
                    <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm bg-lime-100 text-lime-700">
                      Digital + Fisico
                    </span>
                  ) : (
                    <span className={cn(
                      "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm",
                      (book.isDigital || book.fileUrl) ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                    )}>
                      {(book.isDigital || book.fileUrl) ? 'Digital' : 'Fisico'}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-4 flex-grow flex flex-col">
                <h3 className="font-bold text-gray-900 line-clamp-1 mb-1">{book.title}</h3>
                <p className="text-sm text-gray-500 mb-3">{book.author}</p>
                <div className="mt-auto pt-3 border-t border-gray-50 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400">{book.genre}</span>
                  {book.isDigital || book.fileUrl ? (
                    <div className="flex items-center gap-2">
                      {resolveFileUrl(book.fileUrl, book.id) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openReader(book); }}
                          className="text-[10px] bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition-colors font-bold uppercase flex items-center gap-1"
                        >
                          <BookOpen className="w-3 h-3" />
                          Ler PDF
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAddToShelf(book.id); }}
                        disabled={isAddingShelf(book.id) || shelfIds.has(book.id)}
                        className={cn(
                          "text-[10px] px-3 py-1.5 rounded-lg transition-colors font-bold uppercase inline-flex items-center gap-1",
                          (isAddingShelf(book.id) || shelfIds.has(book.id))
                            ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                            : "bg-lime-600 text-white hover:bg-lime-700"
                        )}
                      >
                        {shelfIds.has(book.id) ? (
                          'Na estante'
                        ) : isAddingShelf(book.id) ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            A processar...
                          </>
                        ) : (
                          'Adicionar a estante'
                        )}
                      </button>
                    </div>
                  ) : (
                  <div className="flex flex-col items-end gap-1">
                    <span className={cn("text-[10px] font-bold", book.availableCopies > 0 ? "text-green-600" : "text-red-600")}>
                      {book.availableCopies > 0 ? `${book.availableCopies} disponiveis` : 'Esgotado'}
                    </span>
                    <div className="flex gap-1">
                      {user.isAdmin && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedLabel(book); }}
                          className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-gray-200 transition-colors font-bold uppercase flex items-center gap-1"
                          title="Imprimir etiqueta da lombada"
                        >
                          Etiqueta
                        </button>
                      )}
                      {book.availableCopies > 0 ? (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleBorrow(book.id); }}
                          disabled={isBorrowing(book.id) || hasActiveBorrowRequest(book.id)}
                          className={cn(
                            "text-[10px] px-2 py-1 rounded transition-colors font-bold uppercase inline-flex items-center gap-1",
                            (isBorrowing(book.id) || hasActiveBorrowRequest(book.id))
                              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                              : "bg-lime-600 text-white hover:bg-lime-700"
                          )}
                        >
                          {hasActiveBorrowRequest(book.id)
                            ? getBorrowDisabledLabel(book.id)
                            : isBorrowing(book.id)
                              ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  A processar...
                                </>
                              )
                              : 'Requisitar'}
                        </button>
                      ) : (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleReserve(book.id); }}
                          disabled={isReserving(book.id) || (book.availableCopies ?? 0) <= 0}
                          className={cn(
                            "text-[10px] px-2 py-1 rounded transition-colors font-bold uppercase",
                            (isReserving(book.id) || (book.availableCopies ?? 0) <= 0)
                              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                              : "bg-orange-500 text-white hover:bg-orange-600"
                          )}
                        >
                          {(book.availableCopies ?? 0) <= 0 ? 'Esgotado' : isReserving(book.id) ? 'A processar...' : 'Reservar'}
                        </button>
                      )}
                    </div>
                  </div>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
      )}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>Pagina {page} de {totalPages}</span>
        <div className="flex items-center gap-2">
          <select className="px-3 py-1 border rounded-lg" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            {[12, 24, 36].map(size => (
              <option key={size} value={size}>{size} por pagina</option>
            ))}
          </select>
          <button className="px-3 py-1 border rounded-lg" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Anterior</button>
          <button className="px-3 py-1 border rounded-lg" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Seguinte</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
       
       
      </div>
      <AnimatePresence>
        {ticket && (
          <BorrowTicket 
            activity={ticket} 
            onClose={() => setTicket(null)} 
          />
        )}
        {selectedLabel && (
            <BookLabel 
              book={selectedLabel} 
              onClose={() => setSelectedLabel(null)} 
            />
          )}
        {selectedBook && (
          <BookDetailsModal
            book={selectedBook}
            onClose={() => setSelectedBook(null)}
            onBorrow={handleBorrow}
            onReserve={handleReserve}
            onAddToShelf={handleAddToShelf}
            resolveFileUrl={(fileUrl) => resolveFileUrl(fileUrl, selectedBook?.id)}
            onReadPdf={openReader}
            borrowLoading={isBorrowing(selectedBook?.id)}
            reserveLoading={isReserving(selectedBook?.id)}
            shelfLoading={isAddingShelf(selectedBook?.id)}
            shelfDisabled={shelfIds.has(selectedBook?.id)}
            borrowDisabled={hasActiveBorrowRequest(selectedBook?.id)}
            borrowDisabledLabel={getBorrowDisabledLabel(selectedBook?.id)}
          />
        )}
      </AnimatePresence>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <Toast title={toast.title} message={toast.message} onClose={() => setToast(null)} />
        </div>
      )}
    </div>
  );
};
