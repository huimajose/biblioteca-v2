import React, { useState, useEffect } from 'react';
import { Search, BookOpen, Loader2, Star } from 'lucide-react';
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
import { getRoleLabel } from '@/utils/roles.ts';
import { Toast } from '@/components/Toast.tsx';
import { ReadingListPickerModal } from '@/components/ReadingListPickerModal.tsx';

interface UserPortalProps {
  user: User;
}

export const UserPortal = ({ user }: UserPortalProps) => {
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [activeBorrowMap, setActiveBorrowMap] = useState<Record<number, { tid: number; status: string }>>({});
  const [borrowBlock, setBorrowBlock] = useState<{
    blocked: boolean;
    reason: string | null;
    blockedItems: Array<{ title: string; overdueDays: number }>;
  }>({ blocked: false, reason: null, blockedItems: [] });
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [readingLists, setReadingLists] = useState<any[]>([]);
  const [readingListBook, setReadingListBook] = useState<any | null>(null);
  const [readingListsBusy, setReadingListsBusy] = useState(false);
  const [borrowLoading, setBorrowLoading] = useState<Record<number, boolean>>({});
  const [reserveLoading, setReserveLoading] = useState<Record<number, boolean>>({});
  const [shelfLoading, setShelfLoading] = useState<Record<number, boolean>>({});
  const [favoriteLoading, setFavoriteLoading] = useState<Record<number, boolean>>({});
  const [toast, setToast] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/books').then(res => res.json()).then(setBooks),
      fetch('/api/user/score', { headers: { 'x-user-id': user.id } })
        .then(res => res.json())
        .then(data => setPoints(data?.points ?? 100)),
      fetch('/api/user/student-info', { headers: { 'x-user-id': user.id } })
        .then(res => res.json())
        .then(data => setStudentInfo({ fullName: data?.fullName, studentNumber: data?.studentNumber, role: data?.role, status: data?.status })),
      fetch('/api/user/shelf', { headers: { 'x-user-id': user.id } })
        .then(res => res.json())
        .then(data => {
          const list = Array.isArray(data) ? data : data?.data ?? [];
          const ids = new Set<number>(list.map((entry: any) => entry?.book?.id).filter(Boolean));
          setShelfIds(ids);
        })
        .catch(() => setShelfIds(new Set())),
      fetch('/api/user/favorites', { headers: { 'x-user-id': user.id } })
        .then(res => res.json())
        .then(data => {
          const ids = Array.isArray(data?.bookIds) ? data.bookIds : [];
          setFavoriteIds(new Set(ids.filter(Boolean)));
        })
        .catch(() => setFavoriteIds(new Set())),
      fetch('/api/user/reading-lists', { headers: { 'x-user-id': user.id } })
        .then(res => res.json())
        .then(data => setReadingLists(Array.isArray(data) ? data : []))
        .catch(() => setReadingLists([])),
      fetch('/api/user/borrow-status', { headers: { 'x-user-id': user.id } })
        .then(res => res.json())
        .then(data => {
          setActiveBorrowMap(data?.byBookId ?? {});
          setBorrowBlock({
            blocked: Boolean(data?.blocked),
            reason: data?.blockReason || null,
            blockedItems: Array.isArray(data?.blockedItems) ? data.blockedItems : [],
          });
        })
        .catch(() => {
          setActiveBorrowMap({});
          setBorrowBlock({ blocked: false, reason: null, blockedItems: [] });
        }),
      fetch('/api/genres')
        .then(res => res.json())
        .then(data => setGenres(Array.isArray(data) ? data : []))
        .catch(() => setGenres([])),
      fetch(`/api/books/recommendations?userId=${user.id}`)
        .then(res => res.json())
        .then(data => setRecommendations(Array.isArray(data) ? data : []))
        .catch(() => setRecommendations([])),
    ]).finally(() => setLoading(false));
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
    if (borrowBlock.blocked) {
      notify('Conta bloqueada', borrowBlock.reason || 'Existe atraso prolongado em pelo menos um emprestimo ativo.');
      return;
    }
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
        if (data?.blocked) {
          setBorrowBlock({
            blocked: true,
            reason: data?.sanctions?.reason || data?.error || 'Conta bloqueada por atraso prolongado.',
            blockedItems: Array.isArray(data?.sanctions?.blockedItems) ? data.sanctions.blockedItems : [],
          });
        }
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

  const handleToggleFavorite = async (bookId: number) => {
    if (favoriteLoading[bookId]) return;
    const nextFavorite = !favoriteIds.has(bookId);
    setFavoriteLoading((prev) => ({ ...prev, [bookId]: true }));
    try {
      const res = await fetch(`/api/books/${bookId}/favorite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({ favorite: nextFavorite }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify('Erro ao atualizar favorito', data?.message || 'Nao foi possivel atualizar favoritos.');
        return;
      }
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (nextFavorite) next.add(bookId);
        else next.delete(bookId);
        return next;
      });
      notify(nextFavorite ? 'Adicionado a ler depois' : 'Removido dos favoritos', data?.message || '');
    } finally {
      setFavoriteLoading((prev) => ({ ...prev, [bookId]: false }));
    }
  };

  const handleCreateReadingList = async (name: string, description: string) => {
    if (!name.trim() || readingListsBusy || !readingListBook) return;
    setReadingListsBusy(true);
    try {
      const res = await fetch('/api/user/reading-lists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify('Erro ao criar lista', data?.error || 'Nao foi possivel criar a lista.');
        return;
      }
      const nextLists = Array.isArray(data?.lists) ? data.lists : [];
      setReadingLists(nextLists);
      const created = nextLists[0];
      if (created?.id) {
        await handleAddBookToReadingList(created.id, readingListBook.id, nextLists, true);
      }
    } finally {
      setReadingListsBusy(false);
    }
  };

  const handleAddBookToReadingList = async (
    listId: number,
    bookId: number,
    listsOverride?: any[],
    closeAfter = true
  ) => {
    setReadingListsBusy(true);
    try {
      const res = await fetch(`/api/user/reading-lists/${listId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({ bookId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify('Erro ao guardar em lista', data?.error || 'Nao foi possivel guardar o livro.');
        return;
      }
      const sourceLists = Array.isArray(listsOverride) ? listsOverride : readingLists;
      const book = books.find((entry) => entry.id === bookId) || readingListBook;
      setReadingLists(
        sourceLists.map((list) =>
          list.id === listId
            ? {
                ...list,
                items: (list.items || []).some((item: any) => item.book?.id === bookId)
                  ? list.items
                  : [...(list.items || []), { id: `temp-${listId}-${bookId}`, book, createdAt: new Date().toISOString() }],
              }
            : list
        )
      );
      notify('Guardado na lista', 'Livro adicionado a lista de leitura.');
      if (closeAfter) setReadingListBook(null);
    } finally {
      setReadingListsBusy(false);
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
  const isTogglingFavorite = (bookId: number) => Boolean(favoriteLoading[bookId]);
  const getBorrowStatus = (bookId: number) => String(activeBorrowMap[bookId]?.status || '').toLowerCase();
  const hasActiveBorrowRequest = (bookId: number) => Boolean(activeBorrowMap[bookId]);
  const borrowBlockedLabel = borrowBlock.blocked ? 'Bloqueado por atraso' : null;
  const getBorrowDisabledLabel = (bookId: number) =>
    borrowBlockedLabel || (getBorrowStatus(bookId) === 'borrowed' ? 'Ja emprestado' : 'Pedido pendente');

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Bem-vindo, leitor</h1>
          <p className="text-gray-500">
            Perfil: {getRoleLabel(user.role)}.
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

      <p className="text-xs text-gray-400">
        Para guardar um livro numa lista de leitura, abra o detalhe do livro e use o botao `Guardar em lista`.
      </p>

      {borrowBlock.blocked && (
        <Card className="border border-rose-200 bg-rose-50 p-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-rose-700">Conta bloqueada</h2>
          <p className="mt-1 text-sm text-rose-700">
            {borrowBlock.reason || 'Existem livros com atraso prolongado. Regularize as devolucoes para voltar a requisitar.'}
          </p>
          {borrowBlock.blockedItems.length > 0 && (
            <p className="mt-2 text-xs text-rose-600">
              {borrowBlock.blockedItems
                .slice(0, 3)
                .map((item) => `${item.title} (${item.overdueDays} dia(s) em atraso)`)
                .join(' | ')}
            </p>
          )}
        </Card>
      )}

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

      {loading ? (
        <div className="p-6 text-center text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-2xl">
          A carregar livros...
        </div>
      ) : pagedBooks.length === 0 ? (
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
                <button
                  className={`absolute top-2 left-2 rounded-full p-2 shadow-sm transition-colors ${favoriteIds.has(book.id) ? 'bg-amber-500 text-white' : 'bg-white/90 text-gray-500 hover:text-amber-500'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleFavorite(book.id);
                  }}
                  disabled={isTogglingFavorite(book.id)}
                  title={favoriteIds.has(book.id) ? 'Remover de ler depois' : 'Marcar para ler depois'}
                >
                  {isTogglingFavorite(book.id) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Star className={`w-4 h-4 ${favoriteIds.has(book.id) ? 'fill-current' : ''}`} />
                  )}
                </button>
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          trackClick(book);
                          setSelectedBook(book);
                        }}
                        className="text-[10px] bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors font-bold uppercase"
                      >
                        Detalhes
                      </button>
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          trackClick(book);
                          setSelectedBook(book);
                        }}
                        className="text-[10px] bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200 transition-colors font-bold uppercase"
                      >
                        Detalhes
                      </button>
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
                          disabled={borrowBlock.blocked || isBorrowing(book.id) || hasActiveBorrowRequest(book.id)}
                          className={cn(
                            "text-[10px] px-2 py-1 rounded transition-colors font-bold uppercase inline-flex items-center gap-1",
                            (borrowBlock.blocked || isBorrowing(book.id) || hasActiveBorrowRequest(book.id))
                              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                              : "bg-lime-600 text-white hover:bg-lime-700"
                          )}
                        >
                          {(borrowBlock.blocked || hasActiveBorrowRequest(book.id))
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
            onToggleFavorite={handleToggleFavorite}
            onOpenReadingLists={setReadingListBook}
            favoriteActive={favoriteIds.has(selectedBook?.id)}
            favoriteLoading={isTogglingFavorite(selectedBook?.id)}
            resolveFileUrl={(fileUrl) => resolveFileUrl(fileUrl, selectedBook?.id)}
                          onReadPdf={openReader}
                          borrowLoading={isBorrowing(selectedBook?.id)}
                          reserveLoading={isReserving(selectedBook?.id)}
                          shelfLoading={isAddingShelf(selectedBook?.id)}
                          shelfDisabled={shelfIds.has(selectedBook?.id)}
            borrowDisabled={borrowBlock.blocked || hasActiveBorrowRequest(selectedBook?.id)}
            borrowDisabledLabel={getBorrowDisabledLabel(selectedBook?.id)}
          />
        )}
        {readingListBook && (
          <ReadingListPickerModal
            book={readingListBook}
            lists={readingLists}
            busy={readingListsBusy}
            onClose={() => setReadingListBook(null)}
            onCreateList={handleCreateReadingList}
            onAddToList={(listId, bookId) => handleAddBookToReadingList(listId, bookId)}
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
