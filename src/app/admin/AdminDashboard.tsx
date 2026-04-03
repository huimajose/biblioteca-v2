import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  BookOpen, 
  Users as UsersIcon, 
  History, 
  PlusCircle, 
  UserPlus,
  CheckCircle,
  XCircle,
  BookMarked,
  Printer,
  Zap,
  Clock
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import {Card} from '../../components/ui/Card';
import { InstantServiceModal } from './InstantServiceModal';

const AdminDashboard: React.FC = () => {

  const [stats, setStats] = useState<any>(null);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [isInstantOpen, setIsInstantOpen] = useState(false);

  const topGenres = useMemo(() => {
    const counts = (books || []).reduce((acc: Record<string, number>, b: any) => {
      const key = b.genre || 'Sem curso';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [books]);

  useEffect(() => {
    fetchStats();
    fetchPending();
    fetchBooks();
  }, []);

  const fetchStats = async () => {
    const res = await fetch('/api/admin/stats');
    setStats(await res.json());
  };

  const fetchBooks = async () => {
    const res = await fetch('/api/books');
    const data = await res.json();
    setBooks(Array.isArray(data) ? data : data?.data ?? []);
  };

  const fetchPending = async () => {
    const res = await fetch('/api/admin/pending-users');
    const data = await res.json();
    setPendingUsers(Array.isArray(data) ? data : data?.data ?? []);
  };

  const handleApprove = async (clerkId: string, approve: boolean) => {
    await fetch('/api/admin/approve-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clerkId, approve })
    });
    fetchPending();
    fetchStats();
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6 flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-xl text-blue-600"><BookOpen /></div>
          <div>
            <p className="text-sm text-gray-500">Total de livros</p>
            <p className="text-2xl font-bold">{stats?.books || 0}</p>
          </div>
        </Card>
        <Card className="p-6 flex items-center gap-4">
          <div className="p-3 bg-green-50 rounded-xl text-green-600"><UsersIcon /></div>
          <div>
            <p className="text-sm text-gray-500">Utilizadores ativos</p>
            <p className="text-2xl font-bold">{stats?.users || 0}</p>
          </div>
        </Card>
        <Card className="p-6 flex items-center gap-4">
          <div className="p-3 bg-orange-50 rounded-xl text-orange-600"><History /></div>
          <div>
            <p className="text-sm text-gray-500">Emprestimos ativos</p>
            <p className="text-2xl font-bold">{stats?.borrows || 0}</p>
          </div>
        </Card>
        <Card className="p-6 flex items-center gap-4">
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600"><Clock /></div>
          <div>
            <p className="text-sm text-gray-500">Pedidos pendentes</p>
            <p className="text-2xl font-bold">{stats?.pending || 0}</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 p-6">
          <h2 className="text-lg font-bold mb-6">Visao geral da biblioteca</h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Livros', value: stats?.books || 0, color: '#4f46e5' },
                { name: 'Utilizadores', value: stats?.users || 0, color: '#10b981' },
                { name: 'Emprestimos', value: stats?.borrows || 0, color: '#f59e0b' },
                { name: 'Pendentes', value: stats?.pending || 0, color: '#f59e0b' },
              ]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <Tooltip 
                  cursor={{ fill: '#f9fafb' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={50}>
                  { [0,1,2,3].map((_, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#4f46e5' : index === 1 ? '#10b981' : index === 2 ? '#f59e0b' : '#fbbf24'} />
                  ))} 
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <PlusCircle className="w-5 h-5" /> Acoes rapidas
          </h2>
          <div className="grid grid-cols-1 gap-4">
            <Link to="/admin/books/new" className="p-4 border border-dashed border-gray-300 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-3 text-gray-600">
              <div className="p-2 bg-gray-100 rounded-lg"><BookMarked className="w-5 h-5" /></div>
              <span className="text-sm font-medium">Adicionar novo livro</span>
            </Link>
            <Link to="/admin/reports" className="p-4 border border-dashed border-gray-300 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-3 text-gray-600">
              <div className="p-2 bg-gray-100 rounded-lg"><Printer className="w-5 h-5" /></div>
              <span className="text-sm font-medium">Gerar relatorios</span>
            </Link>
            <button 
              onClick={() => setIsInstantOpen(true)}
              className="p-4 border border-dashed border-yellow-300 bg-yellow-50/30 rounded-xl hover:bg-yellow-50 transition-colors flex items-center gap-3 text-yellow-700"
            >
              <div className="p-2 bg-yellow-100 rounded-lg"><Zap className="w-5 h-5" /></div>
              <span className="text-sm font-bold uppercase tracking-wider">Servico imediato</span>
            </button>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-bold mb-4">Top generos</h2>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topGenres}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
              <Tooltip 
                cursor={{ fill: '#f9fafb' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40} fill="#65a30d" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-8">
        <Card className="p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5" /> Pedidos de acesso pendentes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingUsers.length === 0 ? (
              <p className="text-gray-500 text-sm italic col-span-full">Sem pedidos pendentes.</p>
            ) : (
              pendingUsers.map(user => (
                <div key={user.clerkId} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="overflow-hidden">
                    <p className="font-medium text-sm truncate">{user.email}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-tighter">ID: {user.clerkId}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleApprove(user.clerkId, true)} className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"><CheckCircle className="w-5 h-5" /></button>
                    <button onClick={() => handleApprove(user.clerkId, false)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"><XCircle className="w-5 h-5" /></button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <InstantServiceModal 
        isOpen={isInstantOpen} 
        onClose={() => { 
          setIsInstantOpen(false); 
          fetchStats(); 
          fetchBooks();
        }} 
        books={books} 
      />
    </div>
  );

};

export default AdminDashboard;
