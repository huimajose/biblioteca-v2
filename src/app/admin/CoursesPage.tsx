import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCcw, Save, PlusCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';

type CourseRow = {
  id: number;
  name: string;
  code?: string | null;
  displayOrder?: number | null;
  defaultArmario?: string | null;
  shelfStart?: number | null;
  shelfEnd?: number | null;
};

type DraftMap = Record<number, {
  name: string;
  code: string;
  displayOrder: string;
  defaultArmario: string;
  shelfStart: string;
  shelfEnd: string;
}>;

const toDraft = (course: CourseRow) => ({
  name: course.name || '',
  code: course.code || '',
  displayOrder: course.displayOrder?.toString() || '',
  defaultArmario: course.defaultArmario || '',
  shelfStart: course.shelfStart?.toString() || '',
  shelfEnd: course.shelfEnd?.toString() || '',
});

export const CoursesPage = () => {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | 'new' | null>(null);
  const [renumbering, setRenumbering] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newCourse, setNewCourse] = useState({
    name: '',
    code: '',
    displayOrder: '',
    defaultArmario: '',
    shelfStart: '',
    shelfEnd: '',
  });

  const actorUserId = typeof window !== 'undefined' ? window.localStorage.getItem('userId') || '' : '';

  const loadCourses = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/genres');
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setCourses(list);
      setDrafts(
        Object.fromEntries(list.map((course) => [course.id, toDraft(course)]))
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const orderedCourses = useMemo(
    () => [...courses].sort((a, b) => Number(a.displayOrder ?? 9999) - Number(b.displayOrder ?? 9999) || a.name.localeCompare(b.name)),
    [courses]
  );

  const updateDraft = (id: number, key: keyof DraftMap[number], value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [key]: value,
      },
    }));
  };

  const saveCourse = async (id: number) => {
    const draft = drafts[id];
    if (!draft) return;
    setSavingId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/genres?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': actorUserId },
        body: JSON.stringify({
          id,
          name: draft.name.trim(),
          code: draft.code.trim(),
          displayOrder: draft.displayOrder ? Number(draft.displayOrder) : null,
          defaultArmario: draft.defaultArmario.trim(),
          shelfStart: draft.shelfStart ? Number(draft.shelfStart) : null,
          shelfEnd: draft.shelfEnd ? Number(draft.shelfEnd) : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data?.error || 'Falha ao guardar curso.');
        return;
      }
      setMessage(`Curso ${draft.name} atualizado.`);
      await loadCourses();
    } finally {
      setSavingId(null);
    }
  };

  const createCourse = async () => {
    setSavingId('new');
    setMessage(null);
    try {
      const res = await fetch('/api/genres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': actorUserId },
        body: JSON.stringify({
          name: newCourse.name.trim(),
          code: newCourse.code.trim(),
          displayOrder: newCourse.displayOrder ? Number(newCourse.displayOrder) : null,
          defaultArmario: newCourse.defaultArmario.trim(),
          shelfStart: newCourse.shelfStart ? Number(newCourse.shelfStart) : null,
          shelfEnd: newCourse.shelfEnd ? Number(newCourse.shelfEnd) : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data?.error || 'Falha ao criar curso.');
        return;
      }
      setNewCourse({
        name: '',
        code: '',
        displayOrder: '',
        defaultArmario: '',
        shelfStart: '',
        shelfEnd: '',
      });
      setMessage('Curso criado com sucesso.');
      await loadCourses();
    } finally {
      setSavingId(null);
    }
  };

  const renumberCourse = async (genreName?: string) => {
    setRenumbering(genreName || 'all');
    setMessage(null);
    try {
      const res = await fetch('/api/genres/renumber', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': actorUserId },
        body: JSON.stringify({ genreName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data?.error || 'Falha ao renumerar curso.');
        return;
      }
      setMessage(genreName ? `Curso ${genreName} renumerado.` : 'Todos os cursos foram renumerados.');
    } finally {
      setRenumbering(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Gestao de cursos</h1>
          <p className="text-sm text-gray-500">Controle codigo, ordem fisica, armario padrao e regras de prateleira.</p>
        </div>
        <Button
          variant="secondary"
          className="inline-flex items-center gap-2"
          onClick={() => renumberCourse()}
          disabled={renumbering === 'all'}
        >
          <RefreshCcw className="w-4 h-4" />
          {renumbering === 'all' ? 'A renumerar...' : 'Renumerar todos'}
        </Button>
      </div>

      {message && (
        <Card className="p-4">
          <p className="text-sm text-gray-600">{message}</p>
        </Card>
      )}

      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input className="px-4 py-2 border rounded-lg" placeholder="Nome do curso" value={newCourse.name} onChange={(e) => setNewCourse((prev) => ({ ...prev, name: e.target.value }))} />
          <input className="px-4 py-2 border rounded-lg" placeholder="Codigo" value={newCourse.code} onChange={(e) => setNewCourse((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} />
          <input className="px-4 py-2 border rounded-lg" type="number" placeholder="Ordem" value={newCourse.displayOrder} onChange={(e) => setNewCourse((prev) => ({ ...prev, displayOrder: e.target.value }))} />
          <input className="px-4 py-2 border rounded-lg" placeholder="Armario padrao" value={newCourse.defaultArmario} onChange={(e) => setNewCourse((prev) => ({ ...prev, defaultArmario: e.target.value }))} />
          <input className="px-4 py-2 border rounded-lg" type="number" placeholder="Prat. inicial" value={newCourse.shelfStart} onChange={(e) => setNewCourse((prev) => ({ ...prev, shelfStart: e.target.value }))} />
          <div className="flex gap-3">
            <input className="flex-1 px-4 py-2 border rounded-lg" type="number" placeholder="Prat. final" value={newCourse.shelfEnd} onChange={(e) => setNewCourse((prev) => ({ ...prev, shelfEnd: e.target.value }))} />
            <Button className="inline-flex items-center gap-2" onClick={createCourse} disabled={savingId === 'new' || !newCourse.name.trim()}>
              <PlusCircle className="w-4 h-4" />
              Criar
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-10 text-sm text-gray-400 text-center">A carregar cursos...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="p-4 text-xs uppercase text-gray-400">Curso</th>
                <th className="p-4 text-xs uppercase text-gray-400">Codigo</th>
                <th className="p-4 text-xs uppercase text-gray-400">Ordem</th>
                <th className="p-4 text-xs uppercase text-gray-400">Armario</th>
                <th className="p-4 text-xs uppercase text-gray-400">Prateleiras</th>
                <th className="p-4 text-xs uppercase text-gray-400 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orderedCourses.map((course) => {
                const draft = drafts[course.id] || toDraft(course);
                return (
                  <tr key={course.id} className="hover:bg-gray-50">
                    <td className="p-4">
                      <input className="w-full px-3 py-2 border rounded-lg" value={draft.name} onChange={(e) => updateDraft(course.id, 'name', e.target.value)} />
                    </td>
                    <td className="p-4">
                      <input className="w-full px-3 py-2 border rounded-lg font-mono uppercase" value={draft.code} onChange={(e) => updateDraft(course.id, 'code', e.target.value.toUpperCase())} />
                    </td>
                    <td className="p-4">
                      <input className="w-24 px-3 py-2 border rounded-lg" type="number" value={draft.displayOrder} onChange={(e) => updateDraft(course.id, 'displayOrder', e.target.value)} />
                    </td>
                    <td className="p-4">
                      <input className="w-24 px-3 py-2 border rounded-lg" value={draft.defaultArmario} onChange={(e) => updateDraft(course.id, 'defaultArmario', e.target.value)} />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <input className="w-24 px-3 py-2 border rounded-lg" type="number" value={draft.shelfStart} onChange={(e) => updateDraft(course.id, 'shelfStart', e.target.value)} />
                        <span className="text-gray-400">ate</span>
                        <input className="w-24 px-3 py-2 border rounded-lg" type="number" value={draft.shelfEnd} onChange={(e) => updateDraft(course.id, 'shelfEnd', e.target.value)} />
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="secondary" className="inline-flex items-center gap-2" onClick={() => renumberCourse(course.name)} disabled={renumbering === course.name}>
                          <RefreshCcw className="w-4 h-4" />
                          {renumbering === course.name ? 'A renumerar...' : 'Renumerar'}
                        </Button>
                        <Button className="inline-flex items-center gap-2" onClick={() => saveCourse(course.id)} disabled={savingId === course.id}>
                          <Save className="w-4 h-4" />
                          {savingId === course.id ? 'A guardar...' : 'Guardar'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
};

export default CoursesPage;
