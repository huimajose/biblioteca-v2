import React, { useState } from 'react';
import { ListChecks, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button.tsx';

interface ReadingListPickerModalProps {
  book: any;
  lists: any[];
  onClose: () => void;
  onCreateList: (name: string, description: string) => Promise<void> | void;
  onAddToList: (listId: number, bookId: number) => Promise<void> | void;
  busy?: boolean;
}

export const ReadingListPickerModal = ({
  book,
  lists,
  onClose,
  onCreateList,
  onAddToList,
  busy = false,
}: ReadingListPickerModalProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg">Guardar em lista</h3>
            <p className="text-sm text-gray-500 mt-1">{book?.title}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-lime-700" />
              <p className="text-sm font-bold">Escolher lista existente</p>
            </div>
            {lists.length === 0 ? (
              <p className="text-sm text-gray-400">Ainda nao tem listas. Crie a primeira abaixo.</p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {lists.map((list) => (
                  <button
                    key={list.id}
                    className="w-full rounded-2xl border border-gray-100 p-4 text-left hover:border-lime-200 hover:bg-lime-50/40 transition-all"
                    onClick={() => onAddToList(list.id, book.id)}
                    disabled={busy}
                  >
                    <p className="font-semibold">{list.name}</p>
                    {list.description && <p className="text-xs text-gray-500 mt-1">{list.description}</p>}
                    <p className="text-[11px] uppercase tracking-widest text-gray-400 mt-2">
                      {(list.items || []).length} livro(s)
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-dashed border-gray-200 p-4 space-y-3">
            <p className="text-sm font-bold">Criar nova lista</p>
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
            <Button
              className="inline-flex items-center gap-2"
              onClick={() => onCreateList(name, description)}
              disabled={busy || !name.trim()}
            >
              <Plus className="w-4 h-4" />
              Criar lista
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
