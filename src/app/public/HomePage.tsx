import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Users, Sparkles, ArrowRight, BadgeCheck } from 'lucide-react';
import { Card } from '@/components/ui/Card.tsx';
import { Link } from 'react-router-dom';
import { DEFAULT_BOOK_COVER } from '@/constants.ts';

export const HomePage = () => {
  const [books, setBooks] = useState<any[]>([]);
  const [members, setMembers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [bannerIndex, setBannerIndex] = useState(0);

  const banners = [
    { src: '/1.png', label: 'Biblioteca Digital ISPI' },
    { src: '/2.png', label: 'Novas colecoes digitais' },
    { src: '/3.png', label: 'Acesso rapido aos livros' },
    { src: '/4.png', label: 'Espaco para estudantes' },
    { src: '/5.png', label: 'Leitura sem barreiras' },
  ];

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [booksRes, usersRes] = await Promise.all([
          fetch('/api/books'),
          fetch('/api/user/count')
        ]);
        const booksData = await booksRes.json();
        const usersData = await usersRes.json();
        if (!active) return;
        setBooks(Array.isArray(booksData) ? booksData : []);
        setMembers(usersData?.count ?? 0);
      } catch {
        if (!active) return;
        setBooks([]);
        setMembers(0);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setBannerIndex((current) => (current + 1) % banners.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [banners.length]);

  const availableBooks = useMemo(() => books.length, [books]);
  const weeklyBooks = useMemo(() => books.slice(0, 6), [books]);

  return (
    <div className="space-y-14">
      <section className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen">
        <div className="bg-white border-y border-lime-100">
          <div className="relative h-[320px] sm:h-[380px] md:h-[420px]">
            {banners.map((banner, index) => (
              <img
                key={`wide-${banner.src}`}
                src={banner.src}
                alt={banner.label}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${index === bannerIndex ? 'opacity-100' : 'opacity-0'}`}
              />
            ))}
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/10 to-transparent" />
            <div className="absolute left-6 bottom-6 text-white">
              <p className="text-xs uppercase tracking-[0.3em] text-white/70">Destaque</p>
              <p className="text-3xl md:text-4xl font-black">{banners[bannerIndex]?.label}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-center">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 bg-lime-100 text-lime-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
            
          
          </span>
          <h1 className="text-4xl md:text-5xl font-black leading-tight">
            Biblioteca Digital ISPI
          </h1>
          <p className="text-lg text-gray-600">
            Um espaco digital para estudantes, membros externos e novidades da biblioteca num unico lugar.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/sign-up" className="bg-lime-600 text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-lime-200 hover:bg-lime-700 transition-colors">
              Pedir acesso
            </Link>
            <Link to="/contactos" className="px-6 py-3 rounded-full border border-lime-200 text-gray-700 font-semibold hover:border-lime-400 transition-colors">
              Falar connosco
            </Link>
          </div>
        </div>
        <div className="bg-white border border-lime-100 rounded-3xl shadow-xl p-8 space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-700">Instituicao em destaque</p>
            <span className="text-xs uppercase font-bold text-lime-600">Campus Central</span>
          </div>
          <div className="grid gap-4">
            <div className="rounded-2xl bg-gradient-to-r from-lime-500 via-emerald-500 to-green-600 text-white p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-lime-100">Banner</p>
              <p className="text-2xl font-black mt-2">Semana da Leitura Global</p>
              <p className="text-sm text-lime-100 mt-2">Eventos, clubes de leitura e descontos em requisicoes fisicas.</p>
            </div>
            <div className="rounded-2xl bg-gray-900 text-white p-6 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Destaque</p>
                <p className="text-xl font-black mt-1">Novos livros digitais</p>
              </div>
              <ArrowRight className="w-6 h-6 text-lime-400" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <Card className="p-6 border-lime-100">
          <div className="flex items-center gap-3">
            <div className="bg-lime-100 text-lime-700 p-3 rounded-2xl">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Livros disponiveis</p>
              <p className="text-2xl font-black text-gray-900">{loading ? '...' : availableBooks}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6 border-lime-100">
          <div className="flex items-center gap-3">
            <div className="bg-lime-100 text-lime-700 p-3 rounded-2xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Membros registados</p>
              <p className="text-2xl font-black text-gray-900">{loading ? '...' : members}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6 border-lime-100">
          <div className="flex items-center gap-3">
            <div className="bg-lime-100 text-lime-700 p-3 rounded-2xl">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Livros da semana</p>
              <p className="text-2xl font-black text-gray-900">{loading ? '...' : weeklyBooks.length}</p>
            </div>
          </div>
        </Card>
      </section>

      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black">Galeria em destaque</h2>
          <span className="text-xs uppercase tracking-[0.3em] text-lime-700 font-bold float-slow">
            Rotativo
          </span>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-lime-50 to-transparent pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-emerald-50 to-transparent pointer-events-none" />
          <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory">
            {banners.map((banner, index) => (
              <div
                key={`carousel-${banner.src}`}
                className={`min-w-[240px] sm:min-w-[280px] snap-start rounded-3xl overflow-hidden border border-lime-100 bg-white shadow-lg transition-transform duration-300 hover:-translate-y-1 ${index === bannerIndex ? 'ring-2 ring-lime-500' : ''}`}
              >
                <div className="relative h-40">
                  <img
                    src={banner.src}
                    alt={banner.label}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute left-4 bottom-4 text-white">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/70">Destaque</p>
                    <p className="text-lg font-black">{banner.label}</p>
                  </div>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Campanha</p>
                  <ArrowRight className="w-4 h-4 text-lime-600" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black">Livros da semana</h2>
            <Link to="/sign-in" className="text-sm font-bold text-lime-700 hover:text-lime-600">Ver mais</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {weeklyBooks.map(book => (
              <Card key={book.id} className="p-4 flex gap-4 items-center border-lime-100">
                <img
                  src={DEFAULT_BOOK_COVER}
                  alt={book.title}
                  className="w-16 h-24 rounded-lg object-cover"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <p className="font-bold text-gray-900 line-clamp-1">{book.title}</p>
                  <p className="text-sm text-gray-500 line-clamp-1">{book.author}</p>
                  <p className="text-xs uppercase tracking-widest text-lime-700 mt-2 font-bold">{book.genre}</p>
                </div>
              </Card>
            ))}
            {!weeklyBooks.length && (
              <Card className="p-6 border-dashed border-lime-200 text-gray-500">
                Nenhum livro disponivel neste momento.
              </Card>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <h2 className="text-2xl font-black">Quem pode requisitar</h2>
          <Card className="p-5 border-lime-100 space-y-3">
            <div className="flex items-center gap-3">
              <BadgeCheck className="w-5 h-5 text-lime-600" />
              <p className="font-bold">Estudantes</p>
            </div>
            <p className="text-sm text-gray-600">Acesso completo a livros fisicos e digitais.</p>
          </Card>
          <Card className="p-5 border-lime-100 space-y-3">
            <div className="flex items-center gap-3">
              <BadgeCheck className="w-5 h-5 text-lime-600" />
              <p className="font-bold">Membros externos</p>
            </div>
            <p className="text-sm text-gray-600">Podem requisitar livros mediante aprovacao.</p>
          </Card>
          
        </div>
      </section>
    </div>
  );
};
