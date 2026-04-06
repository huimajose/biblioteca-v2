import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';

export const StudentVerificationsPage = () => {
  const actorUserId = typeof window !== 'undefined' ? window.localStorage.getItem('userId') || '' : '';
  const [requests, setRequests] = useState<any[]>([]);

  const load = async () => {
    const res = await fetch('/api/admin/student-verifications');
    const data = await res.json();
    setRequests(Array.isArray(data) ? data : data?.data ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (id: number, approve: boolean) => {
    await fetch(`/api/admin/student-verifications/${id}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': actorUserId },
      body: JSON.stringify({ approve }),
    });
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Verificacao de estudantes</h1>
        <p className="text-sm text-gray-500">Pedidos pendentes para validacao.</p>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-4 text-xs uppercase text-gray-400">Aluno</th>
              <th className="p-4 text-xs uppercase text-gray-400">Numero</th>
              <th className="p-4 text-xs uppercase text-gray-400">Estado</th>
              <th className="p-4 text-xs uppercase text-gray-400">Data</th>
              <th className="p-4 text-xs uppercase text-gray-400 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {requests.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-10 text-center text-sm text-gray-400">
                  Sem pedidos pendentes.
                </td>
              </tr>
            ) : (
              requests.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="p-4 text-sm font-semibold">{r.fullName || r.clerkId}</td>
                  <td className="p-4 text-sm">{r.studentNumber}</td>
                  <td className="p-4 text-xs uppercase text-gray-500">{r.status}</td>
                  <td className="p-4 text-xs text-gray-500">
                    {r.verifiedAt ? new Date(r.verifiedAt).toLocaleDateString() : new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
                    {r.status === 'pending' && (
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="secondary" className="inline-flex items-center gap-2" onClick={() => decide(r.id, true)}>
                          <CheckCircle className="w-4 h-4" />
                          Aprovar
                        </Button>
                        <Button variant="secondary" className="inline-flex items-center gap-2" onClick={() => decide(r.id, false)}>
                          <XCircle className="w-4 h-4" />
                          Rejeitar
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
};
