import React, { useState } from 'react';
import { Card } from '@/components/ui/Card.tsx';
import { Phone, Mail, MapPin, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button.tsx';

export const ContactsPage = () => {
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('sending');
    setMessage('');
    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get('name'),
      email: form.get('email'),
      message: form.get('message'),
    };
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('failed');
      setStatus('success');
      setMessage('Mensagem enviada. A nossa equipa vai responder brevemente.');
      e.currentTarget.reset();
    } catch {
      setStatus('error');
      setMessage('Nao foi possivel enviar agora. Tente novamente mais tarde.');
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        <h1 className="text-3xl font-black">Contactos</h1>
        <p className="text-gray-600">
          Estamos prontos para apoiar estudantes e membros externos. Use o formulario
          ou os contactos diretos.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5 border-lime-100">
            <Phone className="w-5 h-5 text-lime-600 mb-3" />
            <p className="text-sm text-gray-500">Telefone</p>
            <p className="font-bold">+244 900 000 000</p>
          </Card>
          <Card className="p-5 border-lime-100">
            <Mail className="w-5 h-5 text-lime-600 mb-3" />
            <p className="text-sm text-gray-500">Email</p>
            <p className="font-bold">biblioteca@instituicao.ao</p>
          </Card>
          <Card className="p-5 border-lime-100">
            <MapPin className="w-5 h-5 text-lime-600 mb-3" />
            <p className="text-sm text-gray-500">Endereco</p>
            <p className="font-bold">Campus Central</p>
          </Card>
        </div>
      </div>
      <Card className="p-6 border-lime-100">
        <h2 className="text-xl font-black mb-4">Enviar mensagem</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-700">Nome completo</label>
            <input
              name="name"
              required
              className="mt-1 w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lime-500 outline-none"
              placeholder="Seu nome"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">Email</label>
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lime-500 outline-none"
              placeholder="email@exemplo.com"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">Mensagem</label>
            <textarea
              name="message"
              required
              rows={4}
              className="mt-1 w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lime-500 outline-none"
              placeholder="Como podemos ajudar?"
            />
          </div>
          <Button className="w-full py-3 flex items-center justify-center gap-2">
            Enviar
            <Send className="w-4 h-4" />
          </Button>
          {message && (
            <p className={`text-sm ${status === 'error' ? 'text-red-600' : 'text-lime-700'}`}>
              {message}
            </p>
          )}
        </form>
      </Card>
    </div>
  );
};
