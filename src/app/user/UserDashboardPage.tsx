import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card.tsx';
import { BookOpen, Sparkles, Library, Clock3 } from 'lucide-react';
import { DEFAULT_BOOK_COVER } from '@/constants.ts';
import { BookInfoModal } from '@/components/BookInfoModal.tsx';
import { User } from '@/hooks/useAuth.ts';
import { Button } from '@/components/ui/Button.tsx';
import { ReadingListPickerModal } from '@/components/ReadingListPickerModal.tsx';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

interface UserDashboardPageProps {
  user: User;
}

export const UserDashboardPage = ({ user }: UserDashboardPageProps) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ shelf: 0, borrowed: 0, points: 0 });
  const [borrowBlock, setBorrowBlock] = useState<{ blocked: boolean; reason: string | null }>({
    blocked: false,
    reason: null,
  });
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [continueReading, setContinueReading] = useState<any[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [readingLists, setReadingLists] = useState<any[]>([]);
  const [readingListBook, setReadingListBook] = useState<any | null>(null);
  const [readingListsBusy, setReadingListsBusy] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState<Record<number, boolean>>({});
  const [readingGoal, setReadingGoal] = useState<any | null>(null);
  const [goalForm, setGoalForm] = useState({
    id: 0,
    title: '',
    targetBooks: 1,
    targetPages: 100,
    startDate: '',
    endDate: '',
  });
  const [goalSaving, setGoalSaving] = useState(false);
  const [nextReturn, setNextReturn] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [selectedBook, setSelectedBook] = useState<any | null>(null);
  const [studentInfo, setStudentInfo] = useState<{ course?: string | null; status?: string | null }>({});
  const navigate = useNavigate();

  useEffect(() => {
    const clickedRaw = typeof window !== 'undefined' ? window.localStorage.getItem('recentBookClicks') : null;
    const clickedList = clickedRaw ? JSON.parse(clickedRaw) as number[] : [];
    const recParams = new URLSearchParams({ userId: user.id });
    if (Array.isArray(clickedList) && clickedList.length) {
      recParams.set('clicked', clickedList.slice(0, 10).join(','));
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('userId', user.id);
    }

    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    const fallbackStart = start.toISOString().slice(0, 10);
    const fallbackEnd = end.toISOString().slice(0, 10);

    Promise.all([
      fetch('/api/user/shelf', { headers: { 'x-user-id': user.id } }).then(r => r.json()).catch(() => []),
      fetch('/api/user/history', { headers: { 'x-user-id': user.id } }).then(r => r.json()).catch(() => []),
      fetch('/api/user/score', { headers: { 'x-user-id': user.id } }).then(r => r.json()).catch(() => ({ points: 0 })),
      fetch(`/api/books/recommendations?${recParams.toString()}`).then(r => r.json()).catch(() => []),
      fetch('/api/user/favorites', { headers: { 'x-user-id': user.id } }).then(r => r.json()).catch(() => ({ bookIds: [] })),
      fetch('/api/user/reading-lists', { headers: { 'x-user-id': user.id } }).then(r => r.json()).catch(() => []),
      fetch('/api/user/student-info', { headers: { 'x-user-id': user.id } }).then(r => r.json()).catch(() => ({})),
      fetch(`/api/notifications/${user.id}`).then(r => r.json()).catch(() => []),
      fetch('/api/user/borrow-status', { headers: { 'x-user-id': user.id } }).then(r => r.json()).catch(() => ({})),
      fetch('/api/user/continue-reading', { headers: { 'x-user-id': user.id } }).then(r => r.json()).catch(() => []),
      fetch('/api/user/reading-goals', { headers: { 'x-user-id': user.id } }).then(r => r.json()).catch(() => ({ activeGoal: null })),
    ]).then(([shelf, history, score, recs, favoritesData, readingListsData, fetchedStudentInfo, _notes, borrowStatus, continueData, goalData]) => {
      const shelfCount = Array.isArray(shelf) ? shelf.length : 0;
      const historyList = Array.isArray(history) ? history : [];
      const borrowed = historyList.filter((h) => h.status === 'borrowed').length;
      setStats({ shelf: shelfCount, borrowed, points: score?.points ?? 0 });
      setBorrowBlock({
        blocked: Boolean(borrowStatus?.blocked),
        reason: borrowStatus?.blockReason || null,
      });
      setHistoryItems(historyList);
      setRecommendations(Array.isArray(recs) ? recs : []);
      const favoriteBookIds = Array.isArray(favoritesData?.bookIds) ? favoritesData.bookIds : [];
      setFavoriteIds(new Set(favoriteBookIds.filter(Boolean)));
      setReadingLists(Array.isArray(readingListsData) ? readingListsData : []);
      setStudentInfo({
        course: fetchedStudentInfo?.course || null,
        status: fetchedStudentInfo?.status || null,
      });
      setContinueReading(Array.isArray(continueData) ? continueData.slice(0, 3) : []);
      const activeGoal = goalData?.activeGoal ?? null;
      setReadingGoal(activeGoal);
      setGoalForm({
        id: Number(activeGoal?.id || 0),
        title: String(activeGoal?.title || ''),
        targetBooks: Number(activeGoal?.targetBooks || 1),
        targetPages: Number(activeGoal?.targetPages || 100),
        startDate: String(activeGoal?.startDate || fallbackStart),
        endDate: String(activeGoal?.endDate || fallbackEnd),
      });
      const next = historyList
        .filter((h) => h.status === 'borrowed' && h.expectedReturnDate)
        .sort((a, b) => new Date(a.expectedReturnDate).getTime() - new Date(b.expectedReturnDate).getTime())[0];
      setNextReturn(next?.expectedReturnDate ?? null);
    }).finally(() => setLoading(false));
  }, [user.id]);

  const handleSaveGoal = async () => {
    if (goalSaving) return;
    setGoalSaving(true);
    try {
      const res = await fetch('/api/user/reading-goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify(goalForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const activeGoal = data?.activeGoal ?? null;
      setReadingGoal(activeGoal);
      setGoalForm((prev) => ({
        id: Number(activeGoal?.id || prev.id || 0),
        title: String(activeGoal?.title || ''),
        targetBooks: Number(activeGoal?.targetBooks || prev.targetBooks || 0),
        targetPages: Number(activeGoal?.targetPages || prev.targetPages || 0),
        startDate: String(activeGoal?.startDate || prev.startDate || ''),
        endDate: String(activeGoal?.endDate || prev.endDate || ''),
      }));
    } finally {
      setGoalSaving(false);
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
      if (!res.ok) return;
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (Boolean(data?.favorite)) next.add(bookId);
        else next.delete(bookId);
        return next;
      });
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
      if (!res.ok) return;
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
      if (!res.ok) return;
      const sourceLists = Array.isArray(listsOverride) ? listsOverride : readingLists;
      const book = recommendations.find((entry) => entry.id === bookId) || readingListBook || selectedBook;
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
      if (closeAfter) setReadingListBook(null);
    } finally {
      setReadingListsBusy(false);
    }
  };

  const borrowTrend = useMemo(() => {
    const map = new Map<string, number>();
    historyItems.forEach((h) => {
      const raw = h?.borrowedDate || h?.date || h?.createdAt;
      if (!raw) return;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    const entries = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([key, value]) => {
        const [y, m] = key.split('-');
        return { month: `${m}/${y}`, borrows: value };
      });
    return entries.length ? entries : [{ month: 'N/A', borrows: 0 }];
  }, [historyItems]);

  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = { borrowed: 0, returned: 0, pending: 0 };
    historyItems.forEach((h) => {
      const status = String(h?.status || '').toLowerCase();
      if (status === 'borrowed') counts.borrowed += 1;
      else if (status === 'returned') counts.returned += 1;
      else if (status === 'pending') counts.pending += 1;
    });
    return [
      { name: 'Emprestado', value: counts.borrowed },
      { name: 'Devolvido', value: counts.returned },
      { name: 'Pendente', value: counts.pending },
    ];
  }, [historyItems]);

  return (
    <div className="space-y-6">
      {loading && (
        <Card className="p-10 text-center text-gray-400">A carregar dashboard...</Card>
      )}
      <div>
        <h1 className="text-2xl font-bold">Dashboard do leitor</h1>
        <p className="text-sm text-gray-500">Resumo rapido da sua atividade.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-4 flex items-center gap-3">
          <div className="p-3 bg-lime-100 text-lime-700 rounded-xl">
            <Library className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs uppercase text-gray-400">Na estante</p>
            <p className="text-xl font-bold">{stats.shelf}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-3 bg-orange-100 text-orange-700 rounded-xl">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs uppercase text-gray-400">Emprestimos ativos</p>
            <p className="text-xl font-bold">{stats.borrowed}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs uppercase text-gray-400">Pontos</p>
            <p className="text-xl font-bold">{stats.points}</p>
          </div>
        </Card>
      </div>

      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold">Meta de leitura</h2>
            <p className="text-xs text-gray-400">Defina um alvo de livros concluidos e paginas lidas para o seu periodo atual.</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
            {readingGoal?.progress?.overallPercent ?? 0}% da meta
          </span>
        </div>

        {readingGoal ? (
          <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
            <p className="text-sm font-semibold text-emerald-900">{readingGoal.title || 'Meta ativa'}</p>
            <p className="mt-1 text-xs text-emerald-700">
              {readingGoal.startDate} ate {readingGoal.endDate}
            </p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Livros concluidos</span>
                  <span>{readingGoal.progress?.booksCompleted ?? 0} / {readingGoal.targetBooks}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-600"
                    style={{ width: `${Math.max(4, readingGoal.progress?.booksPercent ?? 0)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Paginas lidas</span>
                  <span>{readingGoal.progress?.pagesRead ?? 0} / {readingGoal.targetPages}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white overflow-hidden">
                  <div
                    className="h-full rounded-full bg-lime-600"
                    style={{ width: `${Math.max(4, readingGoal.progress?.pagesPercent ?? 0)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="mb-5 text-sm text-gray-400">Ainda nao criou nenhuma meta de leitura.</p>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs uppercase text-gray-400">Titulo da meta</label>
            <input
              className="mt-1 w-full rounded-lg border px-4 py-2"
              value={goalForm.title}
              onChange={(e) => setGoalForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: Ler mais Direito este mes"
            />
          </div>
          <div>
            <label className="text-xs uppercase text-gray-400">Livros concluidos</label>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-lg border px-4 py-2"
              value={goalForm.targetBooks}
              onChange={(e) => setGoalForm((prev) => ({ ...prev, targetBooks: Number(e.target.value || 0) }))}
            />
          </div>
          <div>
            <label className="text-xs uppercase text-gray-400">Paginas lidas</label>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-lg border px-4 py-2"
              value={goalForm.targetPages}
              onChange={(e) => setGoalForm((prev) => ({ ...prev, targetPages: Number(e.target.value || 0) }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs uppercase text-gray-400">Inicio</label>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border px-4 py-2"
                value={goalForm.startDate}
                onChange={(e) => setGoalForm((prev) => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs uppercase text-gray-400">Fim</label>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border px-4 py-2"
                value={goalForm.endDate}
                onChange={(e) => setGoalForm((prev) => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button onClick={handleSaveGoal} disabled={goalSaving || (!goalForm.targetBooks && !goalForm.targetPages)}>
            {goalSaving ? 'A guardar...' : readingGoal ? 'Atualizar meta' : 'Criar meta'}
          </Button>
          <span className="text-xs text-gray-400">Pode usar livros, paginas ou os dois ao mesmo tempo.</span>
        </div>
      </Card>

      {borrowBlock.blocked && (
        <Card className="border border-rose-200 bg-rose-50 p-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-rose-700">Emprestimos bloqueados</h2>
          <p className="mt-1 text-sm text-rose-700">
            {borrowBlock.reason || 'Existem livros com atraso prolongado. Regularize as devolucoes para voltar a requisitar.'}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-4 sm:p-6">
          <h2 className="text-lg font-bold mb-4">Tendencia de requisicoes</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={borrowTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="borrows" stroke="#65a30d" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <h2 className="text-lg font-bold mb-4">Estado das requisicoes</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#84cc16" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold">Continuar a ler</h2>
            <p className="text-xs text-gray-400">Retome ate 3 livros exatamente do ponto onde parou.</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-lime-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-lime-700">
            <Clock3 className="h-3 w-3" />
            Em curso
          </span>
        </div>
        {continueReading.length === 0 ? (
          <p className="text-sm text-gray-400">Sem leituras em curso neste momento.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {continueReading.map((entry) => (
              <div
                key={entry.id}
                className="cursor-pointer rounded-2xl border border-gray-100 p-4 hover:border-lime-200 hover:bg-lime-50/40 transition-all"
                onClick={() => navigate(`/reader/${entry.book.id}`)}
              >
                <div className="flex gap-3">
                  <img
                    src={entry.book?.cover || DEFAULT_BOOK_COVER}
                    alt={entry.book?.title}
                    className="h-24 w-16 rounded-xl object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold text-gray-900">{entry.book?.title}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-gray-500">{entry.book?.author}</p>
                    <p className="mt-3 text-[11px] font-semibold text-lime-700">
                      Pagina {entry.currentPage || 1}
                      {entry.totalPages ? ` de ${entry.totalPages}` : ''}
                    </p>
                    <p className="text-[11px] text-gray-500">{entry.progressPercent || 0}% concluido</p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-lime-600"
                    style={{ width: `${Math.max(6, entry.progressPercent || 0)}%` }}
                  />
                </div>
                <button
                  className="mt-3 inline-flex items-center gap-2 text-xs font-bold uppercase text-lime-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/reader/${entry.book.id}`);
                  }}
                >
                  <BookOpen className="h-3 w-3" />
                  Continuar leitura
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-bold uppercase text-gray-500 mb-1">Resumo rapido</h2>
        <p className="text-sm text-gray-700">
          {nextReturn
            ? `Proxima devolucao: ${new Date(nextReturn).toLocaleDateString()}`
            : 'Sem devolucoes pendentes.'}
        </p>
      </Card>

      <Card className="p-4 sm:p-6">
        <h2 className="text-lg font-bold mb-4">Sugestoes para voce</h2>
        <p className="text-xs text-gray-400 mb-4">
          {studentInfo.course
            ? `Baseado no teu curso ${studentInfo.course}, nos teus cliques e no teu historico de leitura.`
            : 'Baseado nos teus cliques, emprestimos e livros na estante.'}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recommendations.length === 0 ? (
            <p className="text-sm text-gray-400">Sem sugestoes neste momento.</p>
          ) : (
            recommendations.map((book) => (
              <div
                key={book.id}
                className="flex cursor-pointer items-center gap-3 rounded-2xl border border-gray-100 p-3 transition-all hover:border-lime-200 hover:bg-lime-50/40 sm:gap-4"
                onClick={() => setSelectedBook(book)}
              >
                <img
                  src="/cover_2.jpeg"
                  alt={book.title}
                  className="h-16 w-12 shrink-0 rounded-lg object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0">
                  <p className="line-clamp-2 font-semibold">{book.title}</p>
                  <p className="line-clamp-1 text-xs text-gray-500">{book.author}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {selectedBook && (
        <BookInfoModal
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          onToggleFavorite={handleToggleFavorite}
          onOpenReadingLists={setReadingListBook}
          favoriteActive={favoriteIds.has(selectedBook?.id)}
          favoriteLoading={Boolean(favoriteLoading[selectedBook?.id])}
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
    </div>
  );
};
