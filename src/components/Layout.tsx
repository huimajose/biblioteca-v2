import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  Users as UsersIcon, 
  History, 
  LogOut, 
  Library,
  Printer,
  ChevronRight,
  BookMarked,
  Bell
} from 'lucide-react';
import { User } from '@/hooks/useAuth.ts';
import { cn } from '@/utils/cn.ts';
import { initPushNotifications } from '@/utils/push.ts';
import { Toast } from '@/components/Toast.tsx';
import { Button } from './ui/Button';

interface LayoutProps {
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
}

export const Layout = ({ user, onLogout, children }: LayoutProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; message: string } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [fullNameRequired, setFullNameRequired] = useState(false);
  const [fullNameDraft, setFullNameDraft] = useState('');
  const [savingFullName, setSavingFullName] = useState(false);
  const displayEmail = user.email || user.id;
  const displayName = user.fullName || displayEmail;
  const displayInitial = displayName ? displayName[0].toUpperCase() : '?';
  const roleLabel = user.isAdmin ? 'Administrador' : user.role === 'student' ? 'Estudante' : 'Externo';

  useEffect(() => {
    if (user.isAdmin) return;
    fetch('/api/user/student-info', { headers: { 'x-user-id': user.id } })
      .then(res => res.json())
      .then(data => setVerificationStatus(data?.status ?? null))
      .catch(() => setVerificationStatus(null));
  }, [user.id, user.isAdmin]);

  useEffect(() => {
    initPushNotifications(user.id);
    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/notifications/stream?userId=${user.id}`);
      es.onmessage = (event) => {
        if (!event.data) return;
        try {
          const text = String(event.data).trim();
          if (!text) return;
          const first = text[0];
          if (first !== "{" && first !== "[") return;
          const payload = JSON.parse(text);
          if (payload?.title) {
            setToast({ title: payload.title, message: payload.message });
            setUnreadCount((c) => c + 1);
          }
        } catch {}
      };
      es.onerror = () => {
        es?.close();
      };
    } catch {
      // ignore if SSE is not available
    }
    return () => es?.close();
  }, [user.id]);

  useEffect(() => {
    fetch('/api/user/profile', { headers: { 'x-user-id': user.id } })
      .then(res => res.json())
      .then((data) => {
        const existing = (data?.fullName || '').trim();
        if (existing) {
          setFullNameRequired(false);
          setFullNameDraft(existing);
        } else {
          setFullNameDraft((user.fullName || '').trim());
          setFullNameRequired(true);
        }
      })
      .catch(() => {
        setFullNameDraft((user.fullName || '').trim());
        setFullNameRequired(true);
      });
  }, [user.id, user.fullName]);

  useEffect(() => {
    fetch(`/api/notifications/unread-count?userId=${user.id}`)
      .then(res => res.json())
      .then(data => setUnreadCount(data?.count ?? 0));
    fetch(`/api/notifications/${user.id}`)
      .then(res => res.json())
      .then(data => setNotifications(Array.isArray(data) ? data : []));
    fetch(`/api/notifications/settings?userId=${user.id}`)
      .then(res => res.json())
      .then(data => setPushEnabled(data?.pushEnabled ?? true));
  }, [user.id]);

  const menuItems = user.isAdmin ? [
    { icon: LayoutDashboard, label: 'Painel', path: '/admin' },
    { icon: BookOpen, label: 'Livros', path: '/admin/books' },
    { icon: UsersIcon, label: 'Utilizadores', path: '/admin/users' },
    { icon: UsersIcon, label: 'Verificacao estudantes', path: '/admin/student-verifications' },
    { icon: History, label: 'Transacoes', path: '/admin/transactions' },
    { icon: Printer, label: 'Relatorios', path: '/admin/reports' },
    { icon: BookMarked, label: 'Modo leitor', path: '/admin/as-user' },
  ] : [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Library, label: 'Biblioteca', path: '/' },
    { icon: BookMarked, label: 'A Minha Estante', path: '/shelf' },
    { icon: History, label: 'O Meu Historico', path: '/history' },
    ...((user.role === 'student' || verificationStatus === 'pending')
      ? []
      : [{ icon: UsersIcon, label: 'Verificacao estudante', path: '/student-verification' }]),
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={cn(
        "bg-white border-r border-gray-200 transition-all duration-300 flex flex-col",
        isSidebarOpen ? "w-64" : "w-20"
      )}>
        <div className="p-6 flex items-center gap-3">
          <div className="bg-lime-600 p-2 rounded-lg text-white">
            <Library className="w-6 h-6" />
          </div>
          {isSidebarOpen && <span className="font-bold text-xl tracking-tight">Biblioteca Digital</span>}
        </div>

        <nav className="flex-grow px-4 space-y-2">
          {menuItems.map(item => (
            <Link 
              key={item.path} 
              to={item.path}
              className="flex items-center gap-3 p-3 rounded-xl text-gray-600 hover:bg-lime-50 hover:text-lime-700 transition-all group"
            >
              <item.icon className="w-5 h-5" />
              {isSidebarOpen && <span className="font-medium">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button 
            onClick={onLogout}
            className="flex items-center gap-3 p-3 w-full rounded-xl text-red-600 hover:bg-red-50 transition-all"
          >
            <LogOut className="w-5 h-5" />
            {isSidebarOpen && <span className="font-medium">Terminar sessao</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow flex flex-col">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRight className={cn("w-5 h-5 transition-transform", isSidebarOpen && "rotate-180")} />
          </button>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                className="p-2 rounded-full hover:bg-gray-100 relative"
                onClick={() => {
                  const next = !notifOpen;
                  setNotifOpen(next);
                  if (next) {
                    fetch('/api/notifications/mark-seen', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
                    }).then(() => setUnreadCount(0));
                  }
                }}
              >
                <Bell className="w-5 h-5 text-gray-500" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 text-[9px] bg-lime-600 text-white rounded-full px-1.5 py-0.5 font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-100 shadow-lg rounded-xl overflow-hidden z-30">
                  <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                    <p className="text-sm font-bold">Notificacoes</p>
                    <button
                      className="text-xs text-lime-700 font-bold"
                      onClick={() => {
                        const next = !pushEnabled;
                        setPushEnabled(next);
                        fetch('/api/notifications/settings', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
                          body: JSON.stringify({ pushEnabled: next }),
                        });
                      }}
                    >
                      {pushEnabled ? 'Silenciar push' : 'Ativar push'}
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-xs text-gray-400">Sem notificacoes.</p>
                    ) : (
                      notifications.slice(0, 10).map((n) => (
                        <div key={n.id} className="p-3 border-b border-gray-50">
                          <p className="text-xs font-bold">{n.title}</p>
                          <p className="text-xs text-gray-500">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">{displayName}</p>
              <div className="flex items-center justify-end gap-2">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">{roleLabel}</p>
                {user.role === 'student' && !user.isAdmin && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-lime-100 text-lime-700">
                    Estudante
                  </span>
                )}
              </div>
            </div>
            <div className="w-10 h-10 bg-lime-100 rounded-full flex items-center justify-center text-lime-700 font-bold">
              {displayInitial}
            </div>
          </div>
        </header>

        <div className="p-8 overflow-y-auto">
          {children}
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <Toast title={toast.title} message={toast.message} onClose={() => setToast(null)} />
        </div>
      )}

      {fullNameRequired && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold">Nome completo obrigatorio</h3>
              <p className="text-xs text-gray-500 mt-1">Precisamos do seu nome completo para assinar registos e notificacoes.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs uppercase text-gray-400">Nome completo</label>
                <input
                  className="w-full px-4 py-2 border rounded-lg"
                  value={fullNameDraft}
                  onChange={(e) => setFullNameDraft(e.target.value)}
                  placeholder="Ex: Maria Joao Silva"
                />
              </div>
            </div>
            <div className="p-6 bg-gray-50 flex gap-3">
              <Button
                className="flex-1"
                disabled={savingFullName || !fullNameDraft.trim()}
                onClick={async () => {
                  setSavingFullName(true);
                  try {
                    const res = await fetch('/api/user/profile', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
                      body: JSON.stringify({
                        fullName: fullNameDraft.trim(),
                        email: user.email,
                        role: user.role,
                      }),
                    });
                    if (res.ok) setFullNameRequired(false);
                  } finally {
                    setSavingFullName(false);
                  }
                }}
              >
                {savingFullName ? 'A guardar...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
