import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileDown, ChevronDown, Pencil } from 'lucide-react';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LOGO_WATERMARK } from '@/constants.ts';
import { addCenteredWatermarkToAllPages, loadWatermarkImage } from '@/utils/pdfWatermark.ts';

export const UsersPage = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'external' | 'admin'>('all');
  const [pdfOpen, setPdfOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const pdfMenuRef = useRef<HTMLDivElement | null>(null);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    fullName: '',
    primaryEmail: '',
    role: 'external',
  });

  useEffect(() => {
    fetch('/api/admin/users')
      .then(res => res.json())
      .then(data => setUsers(Array.isArray(data) ? data : data?.data ?? []));
  }, []);

  useEffect(() => {
    if (!pdfOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (pdfMenuRef.current && !pdfMenuRef.current.contains(target)) {
        setPdfOpen(false);
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPdfOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [pdfOpen]);

  useEffect(() => {
    setPage(1);
  }, [roleFilter]);

  const filtered = useMemo(() => {
    if (roleFilter === 'all') return users;
    return users.filter((u) => String(u.role || 'external').toLowerCase() === roleFilter);
  }, [users, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const exportUsersPdf = async (role: 'all' | 'student' | 'external' | 'admin') => {
    const list = role === 'all' ? users : users.filter((u) => (u.role || 'external') === role);
    const doc = new jsPDF('p', 'pt');
    doc.setFontSize(16);
    doc.text('Relatorio de Utilizadores', 40, 40);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, 40, 58);
    autoTable(doc, {
      startY: 80,
      head: [['Nome', 'Email', 'Tipo']],
      body: list.map((u) => [u.fullName || 'N/D', u.primaryEmail, u.role || 'external']),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [101, 163, 13] },
    });
    try {
      const logo = await loadWatermarkImage(LOGO_WATERMARK);
      addCenteredWatermarkToAllPages(doc, logo, { width: 150 });
    } catch {
      // ignore watermark if logo fails
    }
    doc.save(role === 'all' ? 'usuarios.pdf' : `usuarios-${role}.pdf`);
    setPdfOpen(false);
  };

  const openEdit = (user: any) => {
    setSaveError(null);
    setEditingUser(user);
    setEditDraft({
      fullName: user.fullName || '',
      primaryEmail: user.primaryEmail || '',
      role: user.role || 'external',
    });
  };

  const saveEdit = async () => {
    if (!editingUser) return;
    setSavingUser(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkId: editingUser.clerkId,
          fullName: editDraft.fullName.trim(),
          primaryEmail: editDraft.primaryEmail.trim(),
          role: editDraft.role,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setSaveError(payload?.error || 'Falha ao atualizar utilizador.');
        return;
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.clerkId === editingUser.clerkId
            ? { ...u, fullName: editDraft.fullName.trim(), primaryEmail: editDraft.primaryEmail.trim(), role: editDraft.role }
            : u
        )
      );
      setEditingUser(null);
    } finally {
      setSavingUser(false);
    }
  };

  const changeRoleInline = async (user: any, nextRole: string) => {
    setSaveError(null);
    setSavingUser(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkId: user.clerkId,
          fullName: user.fullName || '',
          primaryEmail: user.primaryEmail || '',
          role: nextRole,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setSaveError(payload?.error || 'Falha ao atualizar utilizador.');
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.clerkId === user.clerkId ? { ...u, role: nextRole } : u))
      );
    } finally {
      setSavingUser(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Utilizadores</h1>
        <p className="text-sm text-gray-500">Lista de utilizadores registados.</p>
      </div>

      <Card className="p-4 overflow-visible">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-3">
            <select className="px-4 py-2 border rounded-lg" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)}>
              <option value="all">Todos</option>
              <option value="student">Estudantes</option>
              <option value="external">Externos</option>
              <option value="admin">Administradores</option>
            </select>
          </div>
          <div className="relative" ref={pdfMenuRef}>
            <Button variant="secondary" className="flex items-center gap-2" onClick={() => setPdfOpen(!pdfOpen)}>
              <FileDown className="w-4 h-4" />
              Relatorio PDF
              <ChevronDown className="w-4 h-4" />
            </Button>
            {pdfOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 shadow-lg rounded-xl overflow-hidden z-20">
                <button className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50" onClick={() => exportUsersPdf('all')}>
                  Todos os utilizadores
                </button>
                <button className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50" onClick={() => exportUsersPdf('student')}>
                  Apenas estudantes
                </button>
                <button className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50" onClick={() => exportUsersPdf('external')}>
                  Apenas externos
                </button>
                <button className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50" onClick={() => exportUsersPdf('admin')}>
                  Apenas administradores
                </button>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-4 text-xs uppercase text-gray-400">Nome</th>
              <th className="p-4 text-xs uppercase text-gray-400">Email</th>
              <th className="p-4 text-xs uppercase text-gray-400">Tipo</th>
              <th className="p-4 text-xs uppercase text-gray-400 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-10 text-center text-sm text-gray-400">
                  Nenhum utilizador encontrado.
                </td>
              </tr>
            ) : (
              paged.map((user) => (
                <tr key={user.clerkId} className="hover:bg-gray-50">
                  <td className="p-4 text-sm font-semibold">{user.fullName || 'N/D'}</td>
                  <td className="p-4 text-sm">{user.primaryEmail}</td>
                  <td className="p-4">
                    <select
                      className="px-3 py-1 border rounded-lg text-xs uppercase text-gray-600"
                      value={user.role || 'external'}
                      onChange={(e) => changeRoleInline(user, e.target.value)}
                      disabled={savingUser}
                    >
                      <option value="external">Externo</option>
                      <option value="student">Estudante</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>
                  <td className="p-4 text-right">
                    <Button
                      variant="secondary"
                      className="inline-flex items-center gap-2"
                      onClick={() => openEdit(user)}
                    >
                      <Pencil className="w-4 h-4" />
                      Editar
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>Pagina {page} de {totalPages}</span>
        <div className="flex items-center gap-2">
          <select className="px-3 py-1 border rounded-lg" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            {[15, 30, 50].map(size => (
              <option key={size} value={size}>{size} por pagina</option>
            ))}
          </select>
          <button className="px-3 py-1 border rounded-lg" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Anterior</button>
          <button className="px-3 py-1 border rounded-lg" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Seguinte</button>
        </div>
      </div>

      {editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold">Editar utilizador</h3>
              <p className="text-xs text-gray-500 mt-1">Atualize os dados principais e o tipo de conta.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs uppercase text-gray-400">Nome completo</label>
                <input
                  className="w-full px-4 py-2 border rounded-lg"
                  value={editDraft.fullName}
                  onChange={(e) => setEditDraft((d) => ({ ...d, fullName: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs uppercase text-gray-400">Email</label>
                <input
                  className="w-full px-4 py-2 border rounded-lg"
                  value={editDraft.primaryEmail}
                  onChange={(e) => setEditDraft((d) => ({ ...d, primaryEmail: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs uppercase text-gray-400">Role</label>
                <select
                  className="w-full px-4 py-2 border rounded-lg"
                  value={editDraft.role}
                  onChange={(e) => setEditDraft((d) => ({ ...d, role: e.target.value }))}
                >
                  <option value="external">Externo</option>
                  <option value="student">Estudante</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              {saveError && <p className="text-xs text-red-600">{saveError}</p>}
            </div>
            <div className="p-6 bg-gray-50 flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setEditingUser(null)} disabled={savingUser}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={saveEdit} disabled={savingUser || !editDraft.fullName.trim()}>
                {savingUser ? 'A guardar...' : 'Guardar alteracoes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
