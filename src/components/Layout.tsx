import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  Users as UsersIcon, 
  History, 
  LogOut, 
  Library,
  FolderTree,
  AlertTriangle,
  Printer,
  ChevronRight,
  BookMarked,
  ListChecks,
  Bell,
  UserCircle,
  ShieldCheck,
  HelpCircle,
  ChevronDown,
  Menu,
  X
} from 'lucide-react';
import { User } from '@/hooks/useAuth.ts';
import { cn } from '@/utils/cn.ts';
import { initPushNotifications } from '@/utils/push.ts';
import { Toast } from '@/components/Toast.tsx';
import { TourGuideAvatar } from '@/components/TourGuideAvatar.tsx';
import { Button } from './ui/Button';
import { canAccessAdminSection, getRoleLabel } from '@/utils/roles.ts';

interface LayoutProps {
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
}

interface MenuItem {
  icon: any;
  label: string;
  path: string;
  badge?: number;
}

interface MenuSection {
  id: string;
  label: string;
  items: MenuItem[];
}

export const Layout = ({ user, onLogout, children }: LayoutProps) => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; message: string } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingTransactionsCount, setPendingTransactionsCount] = useState(0);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [fullNameRequired, setFullNameRequired] = useState(false);
  const [fullNameDraft, setFullNameDraft] = useState('');
  const [savingFullName, setSavingFullName] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [tourRect, setTourRect] = useState<DOMRect | null>(null);
  const displayEmail = user.email || user.id;
  const displayName = user.fullName || displayEmail;
  const displayInitial = displayName ? displayName[0].toUpperCase() : '?';
  const roleLabel = getRoleLabel(user.role);

  useEffect(() => {
    if (user.isStaff) return;
    fetch('/api/user/student-info', { headers: { 'x-user-id': user.id } })
      .then(res => res.json())
      .then(data => setVerificationStatus(data?.status ?? null))
      .catch(() => setVerificationStatus(null));
  }, [user.id, user.isStaff]);

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
            setNotifications((prev) => [
              {
                id: `live-${Date.now()}-${Math.random()}`,
                title: payload.title,
                message: payload.message,
                read: false,
              },
              ...prev,
            ].slice(0, 10));
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

  useEffect(() => {
    if (!user.isStaff) return;

    Promise.all([
      fetch('/api/admin/stats').then((res) => res.json()).catch(() => null),
      fetch('/api/admin/pending-users').then((res) => res.json()).catch(() => []),
    ]).then(([stats, pendingUsers]) => {
      setPendingTransactionsCount(Number(stats?.pending ?? 0));
      setPendingUsersCount(Array.isArray(pendingUsers) ? pendingUsers.length : 0);
    });
  }, [user.id, user.isStaff]);

  const adminMenuItems = [
    canAccessAdminSection(user.role, 'dashboard') ? { icon: LayoutDashboard, label: 'Painel', path: '/admin' } : null,
    canAccessAdminSection(user.role, 'books') ? { icon: BookOpen, label: 'Livros', path: '/admin/books' } : null,
    canAccessAdminSection(user.role, 'catalog-review') ? { icon: AlertTriangle, label: 'Revisao acervo', path: '/admin/catalog-review' } : null,
    canAccessAdminSection(user.role, 'courses') ? { icon: FolderTree, label: 'Cursos', path: '/admin/courses' } : null,
    canAccessAdminSection(user.role, 'users') ? { icon: UsersIcon, label: 'Utilizadores', path: '/admin/users', badge: pendingUsersCount } : null,
    canAccessAdminSection(user.role, 'student-verifications') ? { icon: UsersIcon, label: 'Verificacao estudantes', path: '/admin/student-verifications' } : null,
    canAccessAdminSection(user.role, 'transactions') ? { icon: History, label: 'Transacoes', path: '/admin/transactions', badge: pendingTransactionsCount } : null,
    canAccessAdminSection(user.role, 'reports') ? { icon: Printer, label: 'Relatorios', path: '/admin/reports' } : null,
    canAccessAdminSection(user.role, 'audit') ? { icon: ShieldCheck, label: 'Auditoria', path: '/admin/audit' } : null,
    canAccessAdminSection(user.role, 'reader-mode') ? { icon: BookMarked, label: 'Modo leitor', path: '/admin/as-user' } : null,
    { icon: UserCircle, label: 'Perfil', path: '/profile' },
  ].filter(Boolean) as Array<{ icon: any; label: string; path: string; badge?: number }>;

  const menuItems = user.isStaff ? adminMenuItems : [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Library, label: 'Biblioteca', path: '/' },
    { icon: BookMarked, label: 'A Minha Estante', path: '/shelf' },
    { icon: ListChecks, label: 'Listas de leitura', path: '/lists' },
    { icon: History, label: 'O Meu Historico', path: '/history' },
    { icon: UserCircle, label: 'Perfil', path: '/profile' },
    ...((user.role === 'student' || verificationStatus === 'pending')
      ? []
      : [{ icon: UsersIcon, label: 'Verificacao estudante', path: '/student-verification' }]),
  ];

  const menuSections = useMemo<MenuSection[]>(() => {
    if (user.isStaff) {
      return [
        {
          id: 'admin-core',
          label: 'Operacao',
          items: adminMenuItems.filter((item) =>
            ['/admin', '/admin/books', '/admin/catalog-review', '/admin/courses', '/admin/transactions'].includes(item.path)
          ),
        },
        {
          id: 'admin-governance',
          label: 'Gestao',
          items: adminMenuItems.filter((item) =>
            ['/admin/users', '/admin/student-verifications', '/admin/reports', '/admin/audit'].includes(item.path)
          ),
        },
        {
          id: 'admin-account',
          label: 'Conta',
          items: adminMenuItems.filter((item) =>
            ['/admin/as-user', '/profile'].includes(item.path)
          ),
        },
      ].filter((section) => section.items.length > 0);
    }

    return [
      {
        id: 'reader-main',
        label: 'Principal',
        items: menuItems.filter((item) =>
          ['/dashboard', '/'].includes(item.path)
        ),
      },
      {
        id: 'reader-reading',
        label: 'Leitura',
        items: menuItems.filter((item) =>
          ['/shelf', '/lists'].includes(item.path)
        ),
      },
      {
        id: 'reader-account',
        label: 'Conta',
        items: menuItems.filter((item) =>
          ['/history', '/profile', '/student-verification'].includes(item.path)
        ),
      },
    ].filter((section) => section.items.length > 0);
  }, [adminMenuItems, menuItems, user.isStaff]);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenSections(
      menuSections.reduce((acc, section) => {
        acc[section.id] = true;
        return acc;
      }, {} as Record<string, boolean>)
    );
  }, [user.role, user.isStaff]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const userTourDescriptions: Record<string, string> = {
    '/dashboard': 'Este e o seu painel principal. Aqui ve um resumo rapido da conta, continua livros que deixou a meio, acompanha metas de leitura e percebe logo o que esta pendente sem precisar procurar em varias paginas.',
    '/': 'Esta e a Biblioteca, ou seja, a area para procurar livros. Pode pesquisar por titulo ou autor, abrir os detalhes de qualquer livro, marcar para ler depois, adicionar a estante e iniciar leitura digital quando o livro tiver PDF.',
    '/shelf': 'A Minha Estante guarda os seus livros digitais desbloqueados. Entre aqui quando quiser voltar a um livro que ja abriu, organizar favoritos ou continuar uma leitura sem ter de procurar outra vez no catalogo.',
    '/lists': 'As Listas de leitura servem para organizar o que pretende ler. Pode criar listas como "Provas", "Ler este mes" ou "Direito" para separar livros por objetivo e manter tudo mais arrumado.',
    '/history': 'No Historico acompanha tudo o que ja aconteceu com a sua conta. Aqui aparecem pedidos aceites, livros devolvidos e tambem pedidos rejeitados, para nao ficar com duvidas sobre o estado das suas requisicoes.',
    '/profile': 'No Perfil pode atualizar os seus dados, confirmar o nome usado no sistema e manter a conta correta. Isto ajuda nas notificacoes, nos registos e na identificacao dentro da biblioteca.',
    '/student-verification': 'Esta area e importante para validar que e estudante. Depois da verificacao, o sistema consegue aplicar corretamente os acessos, beneficios e regras da sua conta academica.',
  };

  const userTourSteps = !user.isStaff
    ? [
        ...menuItems.map((item) => ({
          key: `menu-${item.path === '/' ? 'home' : item.path.replace(/[^a-z0-9]+/gi, '-')}`,
          title: item.label,
          description: userTourDescriptions[item.path] || `Use esta opcao para abrir ${item.label.toLowerCase()} e explorar essa area do sistema.`,
        })),
        {
          key: 'notifications',
          title: 'Notificacoes',
          description: 'Use este sino para ver avisos do sistema. Aqui podem aparecer lembretes de devolucao, mensagens sobre reservas, atualizacoes da conta e outras informacoes importantes que merecem atencao.',
        },
        {
          key: 'profile-summary',
          title: 'Resumo do perfil',
          description: 'Nesta zona ve rapidamente quem esta ligado no sistema. Confira aqui o seu nome, o tipo de utilizador e os dados principais da sessao para ter certeza de que entrou na conta certa.',
        },
      ]
    : [];
  const currentTourStep = userTourSteps[tourStepIndex] ?? null;
  const isSmallScreen = typeof window !== 'undefined' && window.innerWidth < 768;

  const getTourCardStyle = () => {
    if (!isSmallScreen) {
      return undefined;
    }

    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
    const sideMargin = 12;
    const cardHeight = 250;

    if (!tourRect) {
      return {
        left: sideMargin,
        right: sideMargin,
        bottom: sideMargin,
      } as const;
    }

    const spaceBelow = viewportHeight - tourRect.bottom;
    const topPosition = Math.min(
      Math.max(sideMargin, tourRect.bottom + 12),
      Math.max(sideMargin, viewportHeight - cardHeight - sideMargin)
    );

    if (spaceBelow >= cardHeight + 24) {
      return {
        left: sideMargin,
        right: Math.max(sideMargin, viewportWidth - Math.max(tourRect.right + 12, viewportWidth * 0.78)),
        top: topPosition,
      } as const;
    }

    return {
      left: sideMargin,
      right: sideMargin,
      bottom: sideMargin,
    } as const;
  };

  const finishTour = (markSeen = true) => {
    setTourActive(false);
    setTourStepIndex(0);
    setTourRect(null);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsMobileMenuOpen(false);
    }
    if (markSeen && !user.isStaff && typeof window !== 'undefined') {
      window.localStorage.setItem(`user-tour-seen:${user.id}`, '1');
    }
  };

  const startTour = () => {
    if (user.isStaff) return;
    setIsSidebarOpen(true);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsMobileMenuOpen(true);
    }
    setTourStepIndex(0);
    setTourActive(true);
  };

  useEffect(() => {
    if (user.isStaff || typeof window === 'undefined') return;
    const seen = window.localStorage.getItem(`user-tour-seen:${user.id}`);
    if (!seen) {
      const timer = window.setTimeout(() => {
        setIsSidebarOpen(true);
        if (window.innerWidth < 768) {
          setIsMobileMenuOpen(true);
        }
        setTourActive(true);
      }, 300);
      return () => window.clearTimeout(timer);
    }
  }, [user.id, user.isStaff]);

  useEffect(() => {
    if (!tourActive || !currentTourStep || typeof window === 'undefined') return;

    const updateRect = () => {
      const target = document.querySelector(`[data-user-tour="${currentTourStep.key}"]`) as HTMLElement | null;
      setTourRect(target ? target.getBoundingClientRect() : null);
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [tourActive, currentTourStep, isSidebarOpen]);

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const renderMenuItem = (item: MenuItem) => {
    const isActive =
      item.path === '/'
        ? location.pathname === '/'
        : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);

    return (
      <Link
        key={item.path}
        to={item.path}
        data-user-tour={!user.isStaff ? `menu-${item.path === '/' ? 'home' : item.path.replace(/[^a-z0-9]+/gi, '-')}` : undefined}
        className={cn(
          'relative flex items-center gap-3 rounded-xl p-3 transition-all group',
          isActive
            ? 'bg-lime-100 text-lime-800 shadow-sm'
            : 'text-gray-600 hover:bg-lime-50 hover:text-lime-700'
        )}
      >
        <item.icon className="h-5 w-5 shrink-0 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:scale-110" />
        {(isSidebarOpen || isMobileMenuOpen) && <span className="font-medium">{item.label}</span>}
        {!!item.badge && (
          <span className={cn(
            'ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700',
            !isSidebarOpen && !isMobileMenuOpen && 'absolute top-2 right-2'
          )}>
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {isMobileMenuOpen && (
        <button
          className="fixed inset-0 z-40 bg-black/45 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-label="Fechar menu"
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-gray-200 bg-white transition-all duration-300 md:static',
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        isMobileMenuOpen ? 'w-[88vw] max-w-[320px]' : isSidebarOpen ? 'md:w-72' : 'md:w-24'
      )}>
        <div className="flex items-center gap-3 p-4 sm:p-6">
          <div className="bg-white p-1 rounded-lg border border-lime-100 shadow-sm">
            <img src="/logo.png" alt="ISPI" className="w-8 h-8 object-contain" />
          </div>
          {(isSidebarOpen || isMobileMenuOpen) && <span className="font-bold text-xl tracking-tight">Biblioteca Digital</span>}
          <button
            className="ml-auto rounded-lg p-2 hover:bg-gray-100 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-grow space-y-4 overflow-y-auto px-4 pb-4">
          {menuSections.map((section) => {
            const sectionOpen = openSections[section.id] ?? true;
            return (
              <div key={section.id} className="space-y-2">
                {(isSidebarOpen || isMobileMenuOpen) ? (
                  <button
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold uppercase tracking-[0.22em] text-gray-400 hover:bg-gray-50"
                    onClick={() => toggleSection(section.id)}
                  >
                    <span>{section.label}</span>
                    <ChevronDown className={cn('h-4 w-4 transition-transform', sectionOpen && 'rotate-180')} />
                  </button>
                ) : (
                  <div className="px-3 py-1 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-gray-300">
                    {section.label.slice(0, 3)}
                  </div>
                )}

                {sectionOpen && (
                  <div className="space-y-1">
                    {section.items.map(renderMenuItem)}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button 
            onClick={onLogout}
            className="flex items-center gap-3 p-3 w-full rounded-xl text-red-600 hover:bg-red-50 transition-all"
          >
            <LogOut className="w-5 h-5" />
            {(isSidebarOpen || isMobileMenuOpen) && <span className="font-medium">Terminar sessao</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow flex flex-col">
        <header className="flex min-h-16 items-center justify-between border-b border-gray-200 bg-white px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="hidden rounded-lg p-2 hover:bg-gray-100 md:block">
              <ChevronRight className={cn("w-5 h-5 transition-transform", isSidebarOpen && "rotate-180")} />
            </button>
            <button onClick={() => setIsMobileMenuOpen(true)} className="rounded-lg p-2 hover:bg-gray-100 md:hidden">
              <Menu className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {!user.isStaff && (
              <button
                className="inline-flex items-center gap-2 rounded-full border border-lime-200 bg-lime-50 px-3 py-1.5 text-xs font-bold text-lime-700 hover:bg-lime-100"
                onClick={startTour}
              >
                <HelpCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Tutorial</span>
              </button>
            )}
            <div className="relative">
              <button
                data-user-tour={!user.isStaff ? 'notifications' : undefined}
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
                <div className="absolute right-0 z-30 mt-2 w-[min(20rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg sm:w-80">
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
            <div data-user-tour={!user.isStaff ? 'profile-summary' : undefined}>
              <div className="hidden text-right sm:block">
                <p className="max-w-[10rem] truncate text-sm font-bold lg:max-w-none">{displayName}</p>
                <div className="flex items-center justify-end gap-2">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">{roleLabel}</p>
                  {user.role === 'student' && !user.isStaff && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-lime-100 text-lime-700">
                      Estudante
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="w-10 h-10 bg-lime-100 rounded-full flex items-center justify-center text-lime-700 font-bold">
              {displayInitial}
            </div>
          </div>
        </header>

        <div className="overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
          <Toast title={toast.title} message={toast.message} onClose={() => setToast(null)} />
        </div>
      )}

      {fullNameRequired && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
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
            <div className="flex gap-3 bg-gray-50 p-6">
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

      {tourActive && !user.isStaff && currentTourStep && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/55" />
          {tourRect && (
            <div
              className="absolute rounded-2xl border-2 border-lime-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] transition-all"
              style={{
                top: Math.max(8, tourRect.top - 8),
                left: Math.max(8, tourRect.left - 8),
                width: tourRect.width + 16,
                height: tourRect.height + 16,
              }}
            />
          )}
          <div
            className="absolute md:inset-x-auto md:right-6 md:bottom-6 md:w-[380px]"
            style={getTourCardStyle()}
          >
            <div className="rounded-2xl bg-white p-5 shadow-2xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-lime-700">
                Tutorial do leitor
              </p>
              <div className="mt-3">
                <TourGuideAvatar title={currentTourStep.title} message={currentTourStep.description} />
              </div>
              <p className="mt-3 text-xs text-gray-400">
                Passo {tourStepIndex + 1} de {userTourSteps.length}
              </p>
              <div className="mt-4 flex items-center gap-3">
                <Button variant="secondary" onClick={() => finishTour(false)}>
                  Fechar
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setTourStepIndex((current) => Math.max(0, current - 1))}
                  disabled={tourStepIndex === 0}
                >
                  Anterior
                </Button>
                <Button
                  onClick={() => {
                    if (tourStepIndex >= userTourSteps.length - 1) {
                      finishTour(true);
                      return;
                    }
                    setTourStepIndex((current) => current + 1);
                  }}
                >
                  {tourStepIndex >= userTourSteps.length - 1 ? 'Concluir' : 'Seguinte'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
