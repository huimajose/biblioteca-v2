import React, { useState } from 'react';
import { Library } from 'lucide-react';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { User } from '@/hooks/useAuth.ts';

interface AuthPageProps {
  onLogin: (user: User) => void;
}

export const AuthPage = ({ onLogin }: AuthPageProps) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [clerkId, setClerkId] = useState('');
  const [message, setMessage] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegister) {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clerkId, email })
      });
      const data = await res.json();
      if (data.success) setMessage(data.message);
      else setMessage(data.error);
    } else {
      if (clerkId === 'admin_123') {
        onLogin({ id: clerkId, isAdmin: true, email: 'admin@library.com' });
      } else {
        onLogin({ id: clerkId, isAdmin: false, email });
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex justify-center mb-6">
          <div className="bg-lime-100 p-3 rounded-2xl">
            <Library className="w-8 h-8 text-lime-600" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center mb-2">Biblioteca Digital</h1>
        <p className="text-gray-500 text-center mb-8">
          {isRegister ? 'Pedir acesso a biblioteca' : 'Iniciar sessao na sua conta'}
        </p>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ID do utilizador (Clerk ID)</label>
            <input 
              type="text" 
              required
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lime-500 outline-none"
              value={clerkId}
              onChange={(e) => setClerkId(e.target.value)}
              placeholder="ex.: user_123 ou admin_123"
            />
          </div>
          {isRegister && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Endereco de email</label>
              <input 
                type="email" 
                required
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lime-500 outline-none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}
          <Button className="w-full py-3">{isRegister ? 'Pedir acesso' : 'Iniciar sessao'}</Button>
        </form>

        {message && <p className="mt-4 text-center text-sm text-lime-600">{message}</p>}

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsRegister(!isRegister)}
            className="text-lime-600 text-sm font-medium hover:underline"
          >
            {isRegister ? 'Ja tem conta? Inicie sessao' : 'Precisa de acesso? Registe-se aqui'}
          </button>
        </div>
      </Card>
    </div>
  );
};
