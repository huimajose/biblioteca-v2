import React, { useEffect, useState } from 'react';
import { BookOpen, ListChecks, Plus, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { DEFAULT_BOOK_COVER } from '@/constants.ts';
import { User } from '@/hooks/useAuth.ts';
import { resolveBookFileUrl } from '@/utils/file.ts';
import { useNavigate } from 'react-router-dom';

interface UserReadingListsPageProps {
  user: User;
}

export const UserReadingListsPage = ({ user }: UserReadingListsPageProps) => {
  const [lists, setLists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyListId, setBusyListId] = useState<number | null>(null);
  const navigate = useNavigate();

  const loadLists = async () => {
    setLoading(true);
    const res = await fetch('/api/user/reading-lists', {
      headers: { 'x-user-id': user.id },
    });
    const data = await res.json().catch(() => []);
    setLists(Array.isArray(data) ? data : data?.lists ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadLists();
  }, [user.id]);

  const handleCreate = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/user/reading-lists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setLists(Array.isArray(data?.lists) ? data.lists : []);
        setName('');
        setDescription('');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteList = async (listId: number) => {
    if (busyListId) return;
    setBusyListId(listId);
    try {
      const res = await fetch(`/api/user/reading-lists/${listId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user.id },
      });
      if (res.ok) {
        setLists((prev) => prev.filter((list) => list.id !== listId));
      }
    } finally {
      setBusyListId(null);
    }
  };

  const handleRemoveBook = async (listId: number, bookId: number) => {
    if (busyListId) return;
    setBusyListId(listId);
    try {
      const res = await fetch(`/api/user/reading-lists/${listId}/items?bookId=${bookId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user.id },
      });
      if (res.ok) {
        setLists((prev) =>
          prev.map((list) =>
            list.id === listId
              ? { ...list, items: (list.items || []).filter((item: any) => item.book?.id !== bookId) }
              : list
          )
        );
      }
    } finally {
      setBusyListId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Listas de leitura</h1>
        <p className="text-sm text-gray-500">Crie listas pessoais para organizar o que quer ler depois.</p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-lime-700" />
          <h2 className="text-lg font-bold">Nova lista</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
          <input
            className="w-full px-4 py-3 border rounded-2xl"
            placeholder="Nome da lista"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="w-full px-4 py-3 border rounded-2xl"
            placeholder="Descricao opcional"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Button className="inline-flex items-center justify-center gap-2" onClick={handleCreate} disabled={creating || !name.trim()}>
            <Plus className="w-4 h-4" />
            {creating ? 'A criar...' : 'Criar'}
          </Button>
        </div>
      </Card>

      {loading ? (
        <Card className="p-10 text-center text-gray-400">A carregar listas de leitura...</Card>
      ) : lists.length === 0 ? (
        <Card className="p-10 text-center text-gray-400">Ainda nao criou listas de leitura.</Card>
      ) : (
        <div className="space-y-4">
          {lists.map((list) => (
            <Card key={list.id} className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold">{list.name}</h3>
                  {list.description && <p className="text-sm text-gray-500 mt-1">{list.description}</p>}
                  <p className="text-[11px] uppercase tracking-widest text-gray-400 mt-2">
                    {(list.items || []).length} livro(s)
                  </p>
                </div>
                <Button
                  variant="secondary"
                  className="inline-flex items-center gap-2 text-red-600 border-red-100 hover:bg-red-50"
                  onClick={() => handleDeleteList(list.id)}
                  disabled={busyListId === list.id}
                >
                  <Trash2 className="w-4 h-4" />
                  Apagar lista
                </Button>
              </div>

              {(list.items || []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-gray-400">
                  Esta lista ainda nao tem livros. Pode adicionar a partir do detalhe de qualquer livro.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {list.items.map((item: any) => (
                    <div key={item.id} className="rounded-2xl border border-gray-100 p-3 flex gap-3 items-center">
                      <img
                        src={item.book?.cover || DEFAULT_BOOK_COVER}
                        alt={item.book?.title}
                        className="w-14 h-20 object-cover rounded-lg"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{item.book?.title}</p>
                        <p className="text-xs text-gray-500 truncate">{item.book?.author}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {resolveBookFileUrl(item.book?.fileUrl, item.book?.id) && (
                            <button
                              className="inline-flex items-center gap-1 text-xs font-bold text-lime-700"
                              onClick={() => navigate(`/reader/${item.book.id}`)}
                            >
                              <BookOpen className="w-3 h-3" />
                              Ler PDF
                            </button>
                          )}
                          <button
                            className="text-xs font-bold text-red-600"
                            onClick={() => handleRemoveBook(list.id, item.book.id)}
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
