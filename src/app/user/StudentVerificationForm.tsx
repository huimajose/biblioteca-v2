import React, { useState } from 'react';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { User } from '@/hooks/useAuth.ts';
import { StudentSticker } from '@/components/StudentSticker.tsx';

interface StudentVerificationFormProps {
  user: User;
}

export const StudentVerificationForm = ({ user }: StudentVerificationFormProps) => {
  const [fullName, setFullName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [course, setCourse] = useState('');
  const [courses, setCourses] = useState<any[]>([]);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [current, setCurrent] = useState<{ status?: string | null; role?: string | null; verifiedAt?: string | null }>({});
  const [studentInfo, setStudentInfo] = useState<{ fullName?: string | null; studentNumber?: string | null; course?: string | null; role?: string | null; status?: string | null }>({});
  const [loadingCurrent, setLoadingCurrent] = useState(true);
  React.useEffect(() => {
    setLoadingCurrent(true);
    fetch('/api/genres')
      .then(res => res.json())
      .then(data => setCourses(Array.isArray(data) ? data : []))
      .catch(() => setCourses([]));
    fetch('/api/user/student-info', { headers: { 'x-user-id': user.id } })
      .then(res => res.json())
      .then(data => {
        setCurrent({ status: data?.status, role: data?.role, verifiedAt: data?.verifiedAt });
        setStudentInfo({ fullName: data?.fullName, studentNumber: data?.studentNumber, course: data?.course, role: data?.role, status: data?.status });
        setCourse(String(data?.course || ''));
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
        body: JSON.stringify({ fullName, studentNumber, course }),
      });
      if (!res.ok) throw new Error('failed');
      setStatus('success');
      setMessage('Pedido enviado. Aguarde a validacao do administrador.');
      setFullName('');
      setStudentNumber('');
      setCourse('');
      setCurrent({ status: 'pending', role: current.role });
    } catch {
      setStatus('error');
      setMessage('Nao foi possivel enviar agora. Tente novamente.');
    }
  };

  if (loadingCurrent) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="space-y-4 p-6 sm:p-8">
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
      <div className="mx-auto max-w-xl">
        <Card className="space-y-4 p-6 sm:p-8">
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
      <div className="mx-auto max-w-xl">
        <Card className="space-y-4 p-6 sm:p-8">
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
    <div className="mx-auto max-w-xl">
    

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
      <Card className="space-y-6 p-6 sm:p-8">
        <div>
          <h1 className="text-2xl font-bold">Verificacao de estudante</h1>
          <p className="text-sm text-gray-500">
            Envie o seu numero de estudante, o nome completo e o curso para validacao.
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
          <div>
            <label className="block text-sm font-medium mb-1">Curso</label>
            <select
              className="w-full px-4 py-2 border rounded-lg"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              required
            >
              <option value="">Selecione o curso</option>
              {courses.map((item) => (
                <option key={item.id} value={item.name}>{item.name}</option>
              ))}
            </select>
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
