import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card.tsx';
import { BookOpen, Sparkles, Library } from 'lucide-react';
import { DEFAULT_BOOK_COVER } from '@/constants.ts';
import { BookInfoModal } from '@/components/BookInfoModal.tsx';
import { User } from '@/hooks/useAuth.ts';
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
  const [stats, setStats] = useState({ shelf: 0, borrowed: 0, points: 0 });
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [recentShelf, setRecentShelf] = useState<any[]>([]);
  const [recentNotifications, setRecentNotifications] = useState<any[]>([]);
  const [nextReturn, setNextReturn] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [selectedBook, setSelectedBook] = useState<any | null>(null);

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

    Promise.all([
      fetch('/api/user/shelf', { headers: { 'x-user-id': user.id } }).then(r => r.json()),
      fetch('/api/user/history', { headers: { 'x-user-id': user.id } }).then(r => r.json()),
      fetch('/api/user/score', { headers: { 'x-user-id': user.id } }).then(r => r.json()),
      fetch(`/api/books/recommendations?${recParams.toString()}`).then(r => r.json()),
      fetch('/api/user/student-info', { headers: { 'x-user-id': user.id } }).then(r => r.json()),
      fetch(`/api/notifications/${user.id}`).then(r => r.json()),
    ]).then(([shelf, history, score, recs, studentInfo, notes]) => {
      const shelfCount = Array.isArray(shelf) ? shelf.length : 0;
      const historyList = Array.isArray(history) ? history : [];
      const borrowed = historyList.filter((h) => h.status === 'borrowed').length;
      setStats({ shelf: shelfCount, borrowed, points: score?.points ?? 0 });
      setHistoryItems(historyList);
      setRecommendations(Array.isArray(recs) ? recs : []);
      setVerificationStatus((studentInfo as any)?.status ?? null);
      setRecentShelf(Array.isArray(shelf) ? shelf.slice(0, 3) : []);
      setRecentNotifications(Array.isArray(notes) ? notes.slice(0, 2) : []);
      const next = historyList
        .filter((h) => h.status === 'borrowed' && h.expectedReturnDate)
        .sort((a, b) => new Date(a.expectedReturnDate).getTime() - new Date(b.expectedReturnDate).getTime())[0];
      setNextReturn(next?.expectedReturnDate ?? null);
    });
  }, [user.id]);

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
      <div>
        <h1 className="text-2xl font-bold">Dashboard do leitor</h1>
        <p className="text-sm text-gray-500">Resumo rapido da sua atividade.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      
     
     

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
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

        <Card className="p-6">
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
       <Card className="p-6">
          <h2 className="text-lg font-bold mb-3">Continuar a ler</h2>
          {recentShelf.length === 0 ? (
            <p className="text-sm text-gray-400">Sem livros digitais adicionados.</p>
          ) : (
            <div className="space-y-3">
              {recentShelf.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => setSelectedBook(entry.book)}
                >
                  <img
                    src="/cover_2.jpeg"
                    alt={entry.book?.title}
                    className="w-10 h-14 rounded-lg object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{entry.book?.title}</p>
                    <p className="text-xs text-gray-500">{entry.book?.author}</p>
                  </div>
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

      <Card className="p-6">
        <h2 className="text-lg font-bold mb-4">Sugestoes para voce</h2>
        <p className="text-xs text-gray-400 mb-4">
          Baseado nos teus cliques, emprestimos e livros na estante.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recommendations.length === 0 ? (
            <p className="text-sm text-gray-400">Sem sugestoes neste momento.</p>
          ) : (
            recommendations.map((book) => (
              <div
                key={book.id}
                className="flex gap-4 items-center cursor-pointer"
                onClick={() => setSelectedBook(book)}
              >
                <img
                  src="/cover_2.jpeg"
                  alt={book.title}
                  className="w-12 h-16 rounded-lg object-cover"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <p className="font-semibold">{book.title}</p>
                  <p className="text-xs text-gray-500">{book.author}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {selectedBook && (
        <BookInfoModal book={selectedBook} onClose={() => setSelectedBook(null)} />
      )}
    </div>
  );
};
