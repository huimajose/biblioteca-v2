import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export const AuthShell = ({ title, subtitle, children }: AuthShellProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-lime-50 via-white to-emerald-50 flex items-center justify-center p-6">
      <div className="w-full max-w-5xl grid gap-8 lg:grid-cols-[1.1fr_0.9fr] items-center">
        <div className="space-y-6">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="bg-white p-2 rounded-2xl border border-lime-100 shadow-sm">
              <img src="/logo.png" alt="ISPI" className="w-12 h-12 object-contain" />
            </div>
            <div>
              <p className="text-lg font-black leading-none">Biblioteca Digital</p>
              <p className="text-xs uppercase tracking-[0.3em] text-lime-700 font-bold">ISPI</p>
            </div>
          </Link>
          <h1 className="text-3xl md:text-4xl font-black leading-tight">{title}</h1>
          <p className="text-gray-600">{subtitle}</p>
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-lime-200 px-5 py-2 text-sm font-semibold text-lime-700 hover:border-lime-300 hover:bg-lime-50 transition-colors"
            >
              Voltar para a pagina inicial
            </Link>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <ShieldCheck className="w-5 h-5 text-lime-600" />
            Login seguro com Clerk e perfis por tipo de utilizador.
          </div>
        </div>
        <div className="bg-white border border-lime-100 rounded-3xl shadow-xl p-6 md:p-8 flex justify-center">
          {children}
        </div>
      </div>
    </div>
  );
};
