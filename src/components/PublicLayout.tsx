import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Phone, Mail, MapPin } from 'lucide-react';
import { cn } from '@/utils/cn.ts';

interface PublicLayoutProps {
  children: React.ReactNode;
  hero?: boolean;
}

export const PublicLayout = ({ children, hero = false }: PublicLayoutProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-lime-50 via-white to-emerald-50 text-gray-900">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-lime-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="bg-white p-1 rounded-xl border border-lime-100 shadow-sm">
              <img src="/logo.png" alt="ISPI" className="w-10 h-10 object-contain" />
            </div>
            <div>
              <p className="font-black text-lg leading-none">Biblioteca Digital</p>
              <p className="text-[10px] uppercase tracking-[0.3em] text-lime-700 font-bold">ISPI</p>
            </div>
          </Link>
          <nav className="flex items-center gap-4 text-sm font-semibold">
            <Link className="text-gray-700 hover:text-lime-700 transition-colors" to="/">Página Inicial</Link>
            <Link className="text-gray-700 hover:text-lime-700 transition-colors" to="/contactos">Contactos</Link>
            <Link className="inline-flex items-center gap-2 bg-lime-600 text-white px-4 py-2 rounded-full shadow-lg shadow-lime-200 hover:bg-lime-700 transition-colors" to="/sign-in">
              Entrar
              <ArrowRight className="w-4 h-4" />
            </Link>
          </nav>
        </div>
      </header>

      <main className={cn("max-w-6xl mx-auto px-6", hero ? "pt-10 pb-16" : "py-12")}>
        {children}
      </main>

      <footer className="border-t border-lime-100 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-10 grid gap-8 md:grid-cols-3 text-sm text-gray-600">
          <div>
            <p className="font-bold text-gray-900 mb-2">Biblioteca Digital ISPI</p>
            <p>Leitura sem barreiras para estudantes, membros externos e equipas administrativas.</p>
          </div>
          <div className="space-y-2">
            <p className="font-bold text-gray-900">Contactos</p>
            <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-lime-600" /> +244 923 456 789</p>
            <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-lime-600" /> biblioteca@ispi.edu.ao</p>
          </div>
          <div className="space-y-2">
            <p className="font-bold text-gray-900">Endereco</p>
            <p className="flex items-start gap-2"><MapPin className="w-4 h-4 text-lime-600 mt-0.5" /> Estrada Cristo Rei, Huila, Lubango - Angola</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
