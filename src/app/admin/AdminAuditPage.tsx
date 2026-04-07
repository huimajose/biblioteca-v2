import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/Card.tsx';

export const AdminAuditPage = () => {
  const actorUserId = typeof window !== 'undefined' ? window.localStorage.getItem('userId') || '' : '';
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/audit-logs', {
          headers: { 'x-user-id': actorUserId },
        });
        const data = await res.json().catch(() => []);
        setLogs(Array.isArray(data) ? data : []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [actorUserId]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return logs;
    return logs.filter((log) =>
      [
        log.actorUserId,
        log.actorRole,
        log.action,
        log.entityType,
        log.entityId,
        log.details,
      ].some((value) => String(value || '').toLowerCase().includes(normalized))
    );
  }, [logs, query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Auditoria administrativa</h1>
        <p className="text-sm text-gray-500">Historico das acoes criticas feitas pela equipa administrativa.</p>
      </div>

      <Card className="p-4">
        <input
          className="w-full px-4 py-3 border rounded-2xl"
          placeholder="Filtrar por utilizador, acao, entidade ou detalhe"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-4 text-xs uppercase text-gray-400">Quando</th>
              <th className="p-4 text-xs uppercase text-gray-400">Ator</th>
              <th className="p-4 text-xs uppercase text-gray-400">Acao</th>
              <th className="p-4 text-xs uppercase text-gray-400">Entidade</th>
              <th className="p-4 text-xs uppercase text-gray-400">Detalhe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-10 text-center text-sm text-gray-400">A carregar auditoria...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-10 text-center">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <ShieldCheck className="w-10 h-10 opacity-20" />
                    <p className="text-sm font-medium italic">Nenhum registo encontrado.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="p-4 text-xs text-gray-500">
                    {log.createdAt ? new Date(log.createdAt).toLocaleString() : 'N/D'}
                  </td>
                  <td className="p-4">
                    <p className="text-sm font-semibold">{log.actorUserId}</p>
                    <p className="text-[10px] uppercase text-gray-400">{log.actorRole}</p>
                  </td>
                  <td className="p-4 text-sm font-medium">{log.action}</td>
                  <td className="p-4 text-sm text-gray-600">
                    {log.entityType}
                    {log.entityId ? ` #${log.entityId}` : ''}
                  </td>
                  <td className="p-4 text-sm text-gray-600">{log.details}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

export default AdminAuditPage;
