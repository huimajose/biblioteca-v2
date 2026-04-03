import React, { useState } from 'react';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { User } from '@/hooks/useAuth.ts';
import { Navigate } from 'react-router-dom';
import { StudentSticker } from '@/components/StudentSticker.tsx';

interface StudentVerificationFormProps {
  user: User;
}

export const StudentVerificationForm = ({ user }: StudentVerificationFormProps) => {
  const [fullName, setFullName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [current, setCurrent] = useState<{ status?: string | null; role?: string | null; verifiedAt?: string | null }>({});
  const [studentInfo, setStudentInfo] = useState<{ fullName?: string | null; studentNumber?: string | null; role?: string | null; status?: string | null }>({});
  const [loadingCurrent, setLoadingCurrent] = useState(true);
  React.useEffect(() => {
    setLoadingCurrent(true);
    fetch('/api/user/student-info', { headers: { 'x-user-id': user.id } })
      .then(res => res.json())
      .then(data => {
        setCurrent({ status: data?.status, role: data?.role, verifiedAt: data?.verifiedAt });
        setStudentInfo({ fullName: data?.fullName, studentNumber: data?.studentNumber, role: data?.role, status: data?.status });
        setLoadingCurrent(false);
      })
      .catch(() => {
        setLoadingCurrent(false);
      });
  }, [user.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setMessage('');
    try {
      const res = await fetch('/api/student-verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
        body: JSON.stringify({ fullName, studentNumber }),
      });
      if (!res.ok) throw new Error('failed');
      setStatus('success');
      setMessage('Pedido enviado. Aguarde a validacao do administrador.');
      setFullName('');
      setStudentNumber('');
      setCurrent({ status: 'pending', role: current.role });
    } catch {
      setStatus('error');
      setMessage('Nao foi possivel enviar agora. Tente novamente.');
    }
  };

  if (current.role === 'student') {
    return <Navigate to="/dashboard" replace />;
  }

  if (loadingCurrent) {
    return (
      <div className="max-w-xl mx-auto">
        <Card className="p-8 space-y-4">
          <h1 className="text-2xl font-bold">A verificar dados</h1>
          <p className="text-sm text-gray-500">
            Estamos a confirmar o seu estado. Por favor, aguarde alguns segundos.
          </p>
        </Card>
      </div>
    );
  }

  if (current.status === 'pending') {
    return (
      <div className="max-w-xl mx-auto">
        <Card className="p-8 space-y-4">
          <h1 className="text-2xl font-bold">Verificacao em andamento</h1>
          <p className="text-sm text-gray-500">
            O seu pedido esta em analise. Aguarde a confirmacao.
          </p>
        </Card>
      </div>
    );
  }

  if (current.status === 'rejected') {
    return (
      <div className="max-w-xl mx-auto">
        <Card className="p-8 space-y-4">
          <h1 className="text-2xl font-bold">Verificacao rejeitada</h1>
          <p className="text-sm text-gray-500">
            O seu pedido foi rejeitado. Caso haja engano, contacte a secretaria.
          </p>
          {current.verifiedAt && (
            <p className="text-xs text-gray-400">Decisao em {new Date(current.verifiedAt).toLocaleDateString()}</p>
          )}
        </Card>
      </div>
    );
  }


if (current.status === 'approved') {
  return (
    <div className="max-w-xl mx-auto">
    

       {(current.status === 'approved') && (
                  <StudentSticker
                    userId={user.id}
                    fullName={studentInfo.fullName || user.fullName}
                    studentNumber={studentInfo.studentNumber || undefined}
                    avatarUrl={user.imageUrl}
                  />
                )}
    </div>
  );

}

  return (
      <Card className="p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Verificacao de estudante</h1>
          <p className="text-sm text-gray-500">
            Envie o seu numero de estudante e o nome completo para validacao.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nome completo</label>
            <input
              className="w-full px-4 py-2 border rounded-lg"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Numero de estudante</label>
            <input
              className="w-full px-4 py-2 border rounded-lg"
              value={studentNumber}
              onChange={(e) => setStudentNumber(e.target.value)}
              required
            />
          </div>
          <Button className="w-full" disabled={status === 'sending'}>
            {status === 'sending' ? 'A enviar...' : 'Enviar pedido'}
          </Button>
          {message && (
            <p className={`text-sm ${status === 'error' ? 'text-red-600' : 'text-lime-700'}`}>
              {message}
            </p>
          )}
        </form>
      </Card>
  )
};
