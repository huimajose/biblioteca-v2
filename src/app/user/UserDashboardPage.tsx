import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card.tsx';
import { BookOpen, Sparkles, Library } from 'lucide-react';
import { DEFAULT_BOOK_COVER } from '@/constants.ts';
import { User } from '@/hooks/useAuth.ts';

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

  useEffect(() => {
    Promise.all([
      fetch('/api/user/shelf', { headers: { 'x-user-id': user.id } }).then(r => r.json()),
      fetch('/api/user/history', { headers: { 'x-user-id': user.id } }).then(r => r.json()),
      fetch('/api/user/score', { headers: { 'x-user-id': user.id } }).then(r => r.json()),
      fetch('/api/books/recommendations').then(r => r.json()),
      fetch('/api/user/student-info', { headers: { 'x-user-id': user.id } }).then(r => r.json()),
      fetch(`/api/notifications/${user.id}`).then(r => r.json()),
    ]).then(([shelf, history, score, recs, studentInfo, notes]) => {
      const shelfCount = Array.isArray(shelf) ? shelf.length : 0;
      const historyList = Array.isArray(history) ? history : [];
      const borrowed = historyList.filter((h) => h.status === 'borrowed').length;
      setStats({ shelf: shelfCount, borrowed, points: score?.points ?? 0 });
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
       
       
      </div>
       <Card className="p-6">
          <h2 className="text-lg font-bold mb-3">Continuar a ler</h2>
          {recentShelf.length === 0 ? (
            <p className="text-sm text-gray-400">Sem livros digitais adicionados.</p>
          ) : (
            <div className="space-y-3">
              {recentShelf.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recommendations.length === 0 ? (
            <p className="text-sm text-gray-400">Sem sugestoes neste momento.</p>
          ) : (
            recommendations.map((book) => (
              <div key={book.id} className="flex gap-4 items-center">
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
    </div>
  );
};
