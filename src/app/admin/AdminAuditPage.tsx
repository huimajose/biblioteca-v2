import React, { useEffect, useMemo, useState } from 'react';
import { Printer, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LOGO_WATERMARK } from '@/constants.ts';
import { addCenteredWatermarkToAllPages, loadWatermarkImage } from '@/utils/pdfWatermark.ts';
import { getAuditActionLabel, getAuditEntityLabel, getAuditRoleLabel, getAuditSearchText } from '@/utils/auditPresentation.ts';

export const AdminAuditPage = () => {
  const actorUserId = typeof window !== 'undefined' ? window.localStorage.getItem('userId') || '' : '';
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

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
    return logs.filter((log) => getAuditSearchText(log).includes(normalized));
  }, [logs, query]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedLogs = filtered.slice((page - 1) * pageSize, page * pageSize);

  const exportPdf = async () => {
    const doc = new jsPDF('p', 'pt');
    doc.setFontSize(16);
    doc.text('Relatorio de auditoria administrativa', 40, 40);
    doc.setFontSize(10);
    doc.text(`Filtro: ${query.trim() || 'Todos os registos'}`, 40, 58);
    doc.text(`Total: ${filtered.length} registo(s)`, 40, 72);

    autoTable(doc, {
      startY: 90,
      head: [['Quando', 'Ator', 'Acao', 'Entidade', 'Detalhe']],
      body: filtered.length
        ? filtered.map((log) => [
            log.createdAt ? new Date(log.createdAt).toLocaleString() : 'N/D',
            `${log.actorUserId || 'N/D'} (${getAuditRoleLabel(log.actorRole)})`,
            getAuditActionLabel(log.action),
            `${getAuditEntityLabel(log.entityType)}${log.entityId ? ` #${log.entityId}` : ''}`,
            log.details || 'Sem detalhe',
          ])
        : [['-', '-', '-', '-', '-']],
      styles: { fontSize: 8, cellWidth: 'wrap' },
      headStyles: { fillColor: [101, 163, 13] },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { cellWidth: 100 },
        2: { cellWidth: 90 },
        3: { cellWidth: 80 },
        4: { cellWidth: 160 },
      },
    });

    try {
      const logo = await loadWatermarkImage(LOGO_WATERMARK);
      addCenteredWatermarkToAllPages(doc, logo, { width: 160 });
    } catch {
      // ignore watermark errors
    }

    doc.save('auditoria-administrativa.pdf');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Auditoria administrativa</h1>
        <p className="text-sm text-gray-500">Historico das acoes criticas feitas pela equipa administrativa.</p>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
          <input
            className="w-full px-4 py-3 border rounded-2xl"
            placeholder="Filtrar por utilizador, acao, entidade ou detalhe"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button variant="secondary" className="inline-flex items-center justify-center gap-2" onClick={exportPdf}>
            <Printer className="w-4 h-4" />
            Imprimir PDF
          </Button>
        </div>
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
            ) : pagedLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-10 text-center">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <ShieldCheck className="w-10 h-10 opacity-20" />
                    <p className="text-sm font-medium italic">Nenhum registo encontrado.</p>
                  </div>
                </td>
              </tr>
            ) : (
              pagedLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="p-4 text-xs text-gray-500">
                    {log.createdAt ? new Date(log.createdAt).toLocaleString() : 'N/D'}
                  </td>
                  <td className="p-4">
                    <p className="text-sm font-semibold">{log.actorUserId}</p>
                    <p className="text-[10px] uppercase text-gray-400">{getAuditRoleLabel(log.actorRole)}</p>
                  </td>
                  <td className="p-4 text-sm font-medium">{getAuditActionLabel(log.action)}</td>
                  <td className="p-4 text-sm text-gray-600">
                    {getAuditEntityLabel(log.entityType)}
                    {log.entityId ? ` #${log.entityId}` : ''}
                  </td>
                  <td className="p-4 text-sm text-gray-600">{log.details}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>Pagina {page} de {totalPages}</span>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 border rounded-lg" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
            Anterior
          </button>
          <button className="px-3 py-1 border rounded-lg" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>
            Seguinte
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminAuditPage;
