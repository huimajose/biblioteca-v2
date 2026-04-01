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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black text-lime-700">Contacte-nos</h1>
          <p className="text-gray-600 mt-2">
            Tem alguma duvida, sugestao ou precisa de ajuda? Envie-nos uma mensagem
            e entraremos em contacto o mais breve possivel.
          </p>
        </div>
        <div className="grid gap-4">
          <div className="flex items-center gap-3">
            <Mail className="text-lime-600" />
            <p className="text-gray-700">biblioteca@ispi.edu.ao</p>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="text-lime-600" />
            <p className="text-gray-700">+244 923 456 789</p>
          </div>
          <div className="flex items-center gap-3">
            <MapPin className="text-lime-600" />
            <p className="text-gray-700">Estrada Cristo Rei, Huila, Lubango - Angola</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-lime-100">
          <iframe
            src="https://www.google.com/maps?q=-14.958230418193224,13.484409623151006&hl=pt&z=17&output=embed"
            className="w-full h-[300px]"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Biblioteca ISPI - Lubango"
          />
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
