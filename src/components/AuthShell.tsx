import React from 'react';
import { Link } from 'react-router-dom';
import { Library, ShieldCheck } from 'lucide-react';

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
            <div className="bg-lime-600 text-white p-3 rounded-2xl">
              <Library className="w-7 h-7" />
            </div>
            <div>
              <p className="text-lg font-black leading-none">Biblioteca Virtual</p>
              <p className="text-xs uppercase tracking-[0.3em] text-lime-700 font-bold">Instituicao</p>
            </div>
          </Link>
          <h1 className="text-3xl md:text-4xl font-black leading-tight">{title}</h1>
          <p className="text-gray-600">{subtitle}</p>
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
