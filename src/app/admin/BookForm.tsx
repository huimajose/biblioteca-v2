import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { DEFAULT_BOOK_COVER } from '@/constants.ts';
import { resolveBookFileUrl } from '@/utils/file.ts';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export const BookForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookId = searchParams.get('id');
  const isEdit = Boolean(bookId);
  const actorUserId = typeof window !== 'undefined' ? window.localStorage.getItem('userId') || '' : '';

  const [activeTab, setActiveTab] = useState<'dados' | 'disponibilidade' | 'media'>('dados');
  const [genres, setGenres] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [initialFileUrl, setInitialFileUrl] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    genre: '',
    isbn: '',
    totalCopies: 1,
    documentType: 1,
    cover: '',
    fileUrl: '',
    isDigital: false,
    hasDigital: false,
    editora: '',
    cdu: '',
    prateleira: '',
    anoEdicao: '',
    edicao: '',
    addCopies: 0,
  });
  const [pendingPdf, setPendingPdf] = useState<{ name: string; base64: string } | null>(null);

  useEffect(() => {
    fetch('/api/genres')
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(text || 'Falha ao carregar cursos.');
        }
        return res.json();
      })
      .then(data => setGenres(Array.isArray(data) ? data : []))
      .catch(() => setGenres([]));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    fetch(`/api/books/${bookId}`)
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(text || 'Falha ao carregar o livro.');
        }
        return res.json();
      })
      .then(data => {
        const apiFileUrl = data.fileUrl ?? data.file_url ?? '';
        const apiTotalCopies = data.totalCopies ?? data.total_copies ?? 1;
        const apiDocumentType = data.documentType ?? data.document_type ?? 1;
        const apiIsDigital = data.isDigital ?? data.is_digital ?? false;
        const apiPrateleira = data.prateleira ?? data.prateleira ?? null;
        const apiAnoEdicao = data.anoEdicao ?? data.ano_edicao ?? null;
        const apiEdicao = data.edicao ?? data.edicao ?? null;

        setInitialFileUrl(apiFileUrl ?? '');
        setFormData({
          title: data.title ?? '',
          author: data.author ?? '',
          genre: data.genre ?? '',
          isbn: data.isbn ?? '',
          totalCopies: apiTotalCopies ?? 1,
          documentType: apiDocumentType ?? 1,
          cover: data.cover ?? '',
          fileUrl: apiFileUrl ?? '',
          isDigital: Boolean(apiIsDigital),
          hasDigital: Boolean(apiFileUrl),
          editora: data.editora ?? '',
          cdu: data.cdu ?? '',
          prateleira: apiPrateleira?.toString() ?? '',
          anoEdicao: apiAnoEdicao?.toString() ?? '',
          edicao: apiEdicao?.toString() ?? '',
          addCopies: 0,
        });
      })
      .catch(() => {
        alert('Falha ao carregar os dados do livro.');
      });
  }, [bookId, isEdit]);


  console.log('Form data:', formData);

  const resolveStorageUrl = (fileUrl?: string | null) => {
    if (pendingPdf && !bookId) return null;
    return resolveBookFileUrl(fileUrl, bookId ? Number(bookId) : undefined);
  };

  const validatePdf = async () => {
    if (!(formData.hasDigital || formData.documentType === 2)) return true;
    if (!formData.fileUrl) return true;
    if (pendingPdf) return true;
    if (formData.fileUrl === initialFileUrl) return true;
    const url = resolveStorageUrl(formData.fileUrl);
    if (!url || !url.startsWith('http')) return true;
    const res = await fetch(`/api/books/file-check?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    return data?.ok;
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const cleaned = result.includes(',') ? result.split(',')[1] : result;
          resolve(cleaned);
        };
        reader.onerror = () => reject(new Error('Falha ao ler PDF.'));
        reader.readAsDataURL(file);
      });
      setPendingPdf({ name: file.name, base64 });
      setFormData({ ...formData, fileUrl: file.name, hasDigital: true });
    } catch {
      alert('Falha ao preparar PDF.');
    } finally {
      setUploading(false);
    }
  };

  const handleCoverUpload = async (file: File) => {
    setUploading(true);
    try {
      const authRes = await fetch('/api/auth');
      const auth = await authRes.json();
      const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
      const urlEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;

      if (!publicKey || !urlEndpoint) {
        alert('ImageKit nao configurado.');
        return;
      }

      const form = new FormData();
      form.append('file', file);
      form.append('fileName', file.name);
      form.append('publicKey', publicKey);
      form.append('signature', auth.signature);
      form.append('expire', String(auth.expire));
      form.append('token', auth.token);

      const upload = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
        method: 'POST',
        body: form,
      });
      const data = await upload.json();

      if (!upload.ok) {
        throw new Error(data?.message || 'Falha ao enviar capa.');
      }

      const coverUrl = data?.url || (data?.filePath ? `${urlEndpoint}/${data.filePath}` : '');
      if (!coverUrl) throw new Error('Falha ao enviar capa.');

      setFormData({ ...formData, cover: coverUrl });
    } catch (e) {
      alert('Falha ao enviar capa.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if ((formData.hasDigital || formData.documentType === 2) && !formData.fileUrl) {
      alert('Informe o PDF para livros digitais.');
      return;
    }

    if (formData.fileUrl) {
      const ok = await validatePdf();
      if (!ok) {
        alert('PDF nao encontrado. Verifique o URL.');
        return;
      }
    }

    const payload = {
      ...formData,
      cover: formData.cover || DEFAULT_BOOK_COVER,
      isDigital: formData.hasDigital || formData.documentType === 2,
      prateleira: formData.prateleira ? Number(formData.prateleira) : null,
      anoEdicao: formData.anoEdicao ? Number(formData.anoEdicao) : null,
      edicao: formData.edicao ? Number(formData.edicao) : null,
      addCopies: Number(formData.addCopies || 0),
    };

    const res = await fetch(isEdit ? `/api/admin/books/${bookId}` : '/api/admin/books', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': actorUserId },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      alert(text || 'Falha ao guardar o livro.');
      return;
    }

    const created = await res.json().catch(() => ({}));
    const resolvedBookId = isEdit ? Number(bookId) : Number(created?.id || created?.data?.id);

    if (pendingPdf && resolvedBookId) {
      const uploadRes = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: resolvedBookId,
          fileName: pendingPdf.name,
          base64: pendingPdf.base64,
        }),
      });
      if (uploadRes.ok) {
        setPendingPdf(null);
      } else {
        alert('Falha ao enviar PDF para o storage.');
      }
    }

    navigate('/admin/books');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Card className="p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Editar livro' : 'Adicionar novo livro'}</h1>
          <p className="text-sm text-gray-500">Organizado por separadores para manter o form leve.</p>
        </div>
        <div className="flex gap-2">
          {(['dados', 'disponibilidade', 'media'] as const).map(tab => (
            <button
              key={tab}
              className={`px-4 py-2 rounded-full text-xs font-bold uppercase ${activeTab === tab ? 'bg-lime-600 text-white' : 'bg-gray-100 text-gray-600'}`}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab === 'dados' ? 'Dados' : tab === 'disponibilidade' ? 'Disponibilidade' : 'Media'}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {activeTab === 'dados' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Titulo</label>
                <input required className="w-full px-4 py-2 border rounded-lg" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Autor</label>
                <input required className="w-full px-4 py-2 border rounded-lg" value={formData.author} onChange={e => setFormData({ ...formData, author: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">ISBN</label>
                <input required className="w-full px-4 py-2 border rounded-lg" value={formData.isbn} onChange={e => setFormData({ ...formData, isbn: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">curso</label>
                <select className="w-full px-4 py-2 border rounded-lg" value={formData.genre} onChange={e => setFormData({ ...formData, genre: e.target.value })}>
                  <option value="">Selecionar curso</option>
                  {genres.map((g) => (
                    <option key={g.id} value={g.name}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Editora</label>
                <input className="w-full px-4 py-2 border rounded-lg" value={formData.editora} onChange={e => setFormData({ ...formData, editora: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">CDU</label>
                <input className="w-full px-4 py-2 border rounded-lg" value={formData.cdu} onChange={e => setFormData({ ...formData, cdu: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Prateleira</label>
                <input
                  type="number"
                  min="0"
                  className="w-full px-4 py-2 border rounded-lg"
                  value={formData.prateleira}
                  onChange={e => setFormData({ ...formData, prateleira: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ano de edicao</label>
                <input
                  type="number"
                  min="0"
                  className="w-full px-4 py-2 border rounded-lg"
                  value={formData.anoEdicao}
                  onChange={e => setFormData({ ...formData, anoEdicao: e.target.value })}
                />
              </div>
            </div>
          )}

          {activeTab === 'disponibilidade' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tipo principal</label>
                <select className="w-full px-4 py-2 border rounded-lg" value={formData.documentType} onChange={e => setFormData({ ...formData, documentType: parseInt(e.target.value) })}>
                  <option value={1}>Fisico</option>
                  <option value={2}>Digital</option>
                </select>
              </div>
              {formData.documentType === 1 && (
                <div>
                  <label className="block text-sm font-medium mb-1">Total de exemplares</label>
                  <input type="number" min="1" className="w-full px-4 py-2 border rounded-lg" value={formData.totalCopies} onChange={e => setFormData({ ...formData, totalCopies: parseInt(e.target.value) })} />
                </div>
              )}
              {isEdit && formData.documentType === 1 && (
                <div>
                  <label className="block text-sm font-medium mb-1">Adicionar exemplares</label>
                  <input type="number" min="0" className="w-full px-4 py-2 border rounded-lg" value={formData.addCopies} onChange={e => setFormData({ ...formData, addCopies: parseInt(e.target.value) || 0 })} />
                  <p className="text-xs text-gray-400 mt-1">Cria novas instancias fisicas.</p>
                </div>
              )}
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Livro fisico com versao digital</label>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.hasDigital}
                    onChange={(e) => setFormData({ ...formData, hasDigital: e.target.checked })}
                  />
                  <span className="text-sm text-gray-500">Ativar PDF para este livro</span>
                </div>
                {formData.hasDigital && (
                  <input
                    className="mt-2 w-full px-4 py-2 border rounded-lg"
                    value={formData.fileUrl}
                    onChange={e => setFormData({ ...formData, fileUrl: e.target.value })}
                    placeholder="URL do PDF ou caminho no storage"
                  />
                )}
              </div>
            </div>
          )}

          {activeTab === 'media' && (
            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-start">
              <div className="space-y-3">
                <img
                  src={resolveStorageUrl(formData.cover) || DEFAULT_BOOK_COVER}
                  alt="Capa"
                  className="w-full h-64 object-cover rounded-xl border"
                  referrerPolicy="no-referrer"
                />
                {formData.fileUrl ? (
                  resolveStorageUrl(formData.fileUrl) ? (
                    <iframe
                      title="PDF preview"
                      src={resolveStorageUrl(formData.fileUrl) || ''}
                      className="w-full h-56 border rounded-lg"
                    />
                  ) : (
                    <div className="w-full h-56 border rounded-lg bg-gray-50 flex items-center justify-center text-xs text-gray-400">
                      PDF indisponivel para pre-visualizacao.
                    </div>
                  )
                ) : (
                  <div className="w-full h-56 border rounded-lg bg-gray-50 flex items-center justify-center text-xs text-gray-400">
                    Nenhum PDF associado.
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">URL da capa</label>
                  <div className="flex gap-2">
                    <input className="w-full px-4 py-2 border rounded-lg" value={formData.cover} onChange={e => setFormData({ ...formData, cover: e.target.value })} placeholder="Deixar vazio para capa predefinida" />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={async () => {
                        if (!formData.isbn) return;
                        const res = await fetch(`/api/books/cover?isbn=${encodeURIComponent(formData.isbn)}`);
                        const data = await res.json();
                        if (data?.url) setFormData({ ...formData, cover: data.url });
                      }}
                    >
                      Buscar capa
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Upload PDF</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(file);
                    }}
                  />
                  {uploading && <p className="text-xs text-gray-500 mt-1">A enviar PDF...</p>}
                  {formData.fileUrl ? (
                    <p className="text-xs text-gray-500 mt-1">PDF carregado: {formData.fileUrl}</p>
                  ) : (
                    <p className="text-xs text-gray-400 mt-1">Nenhum PDF carregado.</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Enviar capa</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleCoverUpload(file);
                    }}
                  />
                  {uploading && <p className="text-xs text-gray-500 mt-1">A enviar capa...</p>}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-4">
            <Button variant="secondary" type="button" onClick={() => navigate(-1)}>Cancelar</Button>
            <Button type="submit">{isEdit ? 'Guardar alteracoes' : 'Adicionar livro'}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default BookForm;
