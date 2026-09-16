import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { DEFAULT_BOOK_COVER } from '@/constants.ts';
import { resolveBookFileUrl } from '@/utils/file.ts';
import { getUploadError } from '@/utils/uploadError';

export const BookForm = () => {
  const navigate = useNavigate();
  const { getToken } = useClerkAuth();
  const [searchParams] = useSearchParams();
  const bookId = searchParams.get('id');
  const isEdit = Boolean(bookId);

  const [activeTab, setActiveTab] = useState<'dados' | 'disponibilidade' | 'media'>('dados');
  const [genres, setGenres] = useState<any[]>([]);
  const [uploading, setUploading] = useState<'pdf' | 'cover' | null>(null);
  const [saving, setSaving] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [pdfName, setPdfName] = useState('');
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
    armario: '',
    prateleira: '',
    anoEdicao: '',
    edicao: '',
    addCopies: 0,
  });

  const getActorUserId = () =>
    typeof window !== 'undefined' ? window.localStorage.getItem('userId') || '' : '';

  const getGenreMeta = (genreName: string) =>
    genres.find((genre) => String(genre.name || '').toLowerCase() === String(genreName || '').toLowerCase()) || null;

  const selectedGenreMeta = useMemo(() => getGenreMeta(formData.genre), [formData.genre, genres]);

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
          armario: data.armario?.toString() ?? '',
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

  const handleGenreChange = (nextGenre: string) => {
    setFormData((prev) => {
      const previousMeta = getGenreMeta(prev.genre);
      const nextMeta = getGenreMeta(nextGenre);
      const currentArmario = String(prev.armario || '').trim();
      const previousDefaultArmario = String(previousMeta?.defaultArmario || '').trim();
      const nextDefaultArmario = String(nextMeta?.defaultArmario || '').trim();
      const shouldAutofillArmario =
        !currentArmario || (previousDefaultArmario && currentArmario === previousDefaultArmario);

      return {
        ...prev,
        genre: nextGenre,
        armario: shouldAutofillArmario ? nextDefaultArmario : prev.armario,
      };
    });
  };

  const resolveStorageUrl = (fileUrl?: string | null) =>
    resolveBookFileUrl(fileUrl, bookId ? Number(bookId) : undefined);

  const handleFileUpload = async (file: File, kind: 'pdf' | 'cover') => {
    if (uploading || saving) return;
    setMediaError('');
    const validType = kind === 'pdf'
      ? file.type === 'application/pdf' || (!file.type && /\.pdf$/i.test(file.name))
      : ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
    const limit = 50 * 1024 * 1024;
    if (!validType || !file.size || file.size > limit) {
      setMediaError(kind === 'pdf' ? 'Selecione um PDF até 50 MB.' : 'Selecione uma imagem JPG, PNG ou WebP até 50 MB.');
      return;
    }
    setUploading(kind);
    try {
      const token = await getToken();
      if (!token) throw new Error('Inicie sessão novamente para enviar ficheiros.');
      const authRes = await fetch('/api/admin/books/upload-auth', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token },
      });
      const auth = await authRes.json().catch(() => ({}));
      if (!authRes.ok) throw new Error(auth.error || `Não foi possível preparar o envio (HTTP ${authRes.status}).`);
      if (!auth.publicKey || !auth.signature || !auth.token || !Number.isFinite(Number(auth.expire))) {
        throw new Error('O servidor devolveu uma autorização de upload incompleta. Tente novamente.');
      }
      const body = new FormData();
      body.append('file', file);
      body.append('fileName', file.name);
      body.append('folder', kind === 'pdf' ? '/books/documents' : '/books/covers');
      body.append('publicKey', auth.publicKey);
      body.append('signature', auth.signature);
      body.append('expire', String(auth.expire));
      body.append('token', auth.token);
      const response = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', body });
      const uploaded = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getUploadError(response.status, uploaded));
      if (typeof uploaded.url !== 'string' || !uploaded.url.startsWith('https://')) {
        throw new Error('O serviço recebeu o ficheiro, mas não devolveu um endereço válido. Tente novamente.');
      }
      setFormData(prev => kind === 'pdf'
        ? { ...prev, fileUrl: uploaded.url, hasDigital: true }
        : { ...prev, cover: uploaded.url });
      if (kind === 'pdf') setPdfName(file.name);
    } catch (error) {
      setMediaError(error instanceof Error ? error.message : 'Falha ao enviar o ficheiro.');
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploading || saving) return;
    if (!formData.title.trim() || !formData.author.trim()) {
      setActiveTab('dados');
      setMediaError('Preencha o título e o autor.');
      return;
    }
    if ((formData.hasDigital || formData.documentType === 2) && !formData.fileUrl) {
      setActiveTab('media');
      setMediaError('Selecione e envie o PDF antes de guardar o livro.');
      return;
    }
    setSaving(true);
    setMediaError('');
    try {
      const payload = {
        ...formData,
        cover: formData.cover || DEFAULT_BOOK_COVER,
        isDigital: formData.hasDigital || formData.documentType === 2,
        armario: formData.armario ? String(formData.armario) : null,
        prateleira: formData.prateleira ? Number(formData.prateleira) : null,
        anoEdicao: formData.anoEdicao ? Number(formData.anoEdicao) : null,
        edicao: formData.edicao ? Number(formData.edicao) : null,
        addCopies: Number(formData.addCopies || 0),
      };

      const res = await fetch(isEdit ? `/api/admin/books/${bookId}` : '/api/admin/books', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': getActorUserId() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        setMediaError(error.error || 'Não foi possível guardar o livro. Verifique os dados e tente novamente.');
        return;
      }

      navigate('/admin/books');
    } catch {
      setMediaError('Não foi possível guardar o livro. Os ficheiros enviados foram mantidos; tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Card className="p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Editar livro' : 'Adicionar novo livro'}</h1>
          <p className="text-sm text-gray-500">Organizado por separadores para manter o formulário leve.</p>
        </div>
        <div className="flex gap-2">
          {(['dados', 'disponibilidade', 'media'] as const).map(tab => (
            <button
              key={tab}
              className={`px-4 py-2 rounded-full text-xs font-bold uppercase ${activeTab === tab ? 'bg-lime-600 text-white' : 'bg-gray-100 text-gray-600'}`}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab === 'dados' ? 'Dados' : tab === 'disponibilidade' ? 'Disponibilidade' : 'Ficheiros'}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {activeTab === 'dados' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Título</label>
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
                <label className="block text-sm font-medium mb-1">Curso</label>
                <select className="w-full px-4 py-2 border rounded-lg" value={formData.genre} onChange={e => handleGenreChange(e.target.value)}>
                  <option value="">Selecionar curso</option>
                  {genres.map((g) => (
                    <option key={g.id} value={g.name}>{g.name}</option>
                  ))}
                </select>
                {selectedGenreMeta && (
                  <p className="mt-1 text-xs text-gray-500">
                    Código {selectedGenreMeta.code || 'CUR'} | Ordem {selectedGenreMeta.displayOrder || 'N/D'} | Armário padrão {selectedGenreMeta.defaultArmario || 'N/D'} | Prateleiras {selectedGenreMeta.shelfStart ?? 'N/D'}-{selectedGenreMeta.shelfEnd ?? 'N/D'}
                  </p>
                )}
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
                <label className="block text-sm font-medium mb-1">Armário</label>
                <input
                  className="w-full px-4 py-2 border rounded-lg"
                  value={formData.armario}
                  onChange={e => setFormData({ ...formData, armario: e.target.value })}
                  placeholder="Deixar vazio para usar o padrão do curso"
                />
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
                <label className="block text-sm font-medium mb-1">Ano de edição</label>
                <input
                  type="number"
                  min="0"
                  className="w-full px-4 py-2 border rounded-lg"
                  value={formData.anoEdicao}
                  onChange={e => setFormData({ ...formData, anoEdicao: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Edição</label>
                <select
                  className="w-full px-4 py-2 border rounded-lg"
                  value={formData.edicao}
                  onChange={e => setFormData({ ...formData, edicao: e.target.value })}
                >
                  <option value="">Selecionar edição</option>
                  {Array.from({ length: 100 }, (_, index) => {
                    const edition = String(index + 1);
                    return (
                      <option key={edition} value={edition}>
                        {edition}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          )}

          {activeTab === 'disponibilidade' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tipo principal</label>
                <select className="w-full px-4 py-2 border rounded-lg" value={formData.documentType} onChange={e => setFormData({ ...formData, documentType: parseInt(e.target.value) })}>
                  <option value={1}>Físico</option>
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
                  <p className="text-xs text-gray-400 mt-1">Cria novas instâncias físicas.</p>
                </div>
              )}
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Livro físico com versão digital</label>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.hasDigital}
                    onChange={(e) => setFormData({ ...formData, hasDigital: e.target.checked })}
                  />
                  <span className="text-sm text-gray-500">Ativar PDF para este livro</span>
                </div>
                {(formData.hasDigital || formData.documentType === 2) && (
                  <Button type="button" variant="secondary" onClick={() => setActiveTab('media')}>
                    {formData.fileUrl ? 'Ver ou substituir PDF' : 'Selecionar PDF'}
                  </Button>
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
                  onError={(event) => {
                    const image = event.currentTarget;
                    if (image.getAttribute('src') !== DEFAULT_BOOK_COVER) image.src = DEFAULT_BOOK_COVER;
                  }}
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
                      PDF indisponível para pré-visualização.
                    </div>
                  )
                ) : (
                  <div className="w-full h-56 border rounded-lg bg-gray-50 flex items-center justify-center text-xs text-gray-400">
                    Nenhum PDF associado.
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div className="rounded-xl border border-dashed p-4 space-y-2">
                  <label htmlFor="book-pdf" className="block text-sm font-medium">Ficheiro PDF</label>
                  <input id="book-pdf" type="file" accept="application/pdf,.pdf"
                    disabled={Boolean(uploading) || saving}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) void handleFileUpload(file, 'pdf');
                      e.target.value = '';
                    }} />
                  <p className="text-xs text-gray-500">Selecione um PDF do seu dispositivo, até 50 MB. O envio começa automaticamente.</p>
                  <p role="status" className="text-sm text-gray-600">
                    {uploading === 'pdf' ? 'A enviar PDF…' : formData.fileUrl
                      ? (pdfName ? 'PDF enviado: ' + pdfName : 'Este livro já tem um PDF. Selecione outro para o substituir.')
                      : 'Nenhum PDF selecionado.'}
                  </p>
                </div>
                <div className="rounded-xl border border-dashed p-4 space-y-2">
                  <label htmlFor="book-cover" className="block text-sm font-medium">Imagem da capa</label>
                  <input id="book-cover" type="file" accept="image/jpeg,image/png,image/webp"
                    disabled={Boolean(uploading) || saving}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) void handleFileUpload(file, 'cover');
                      e.target.value = '';
                    }} />
                  <p className="text-xs text-gray-500">JPG, PNG ou WebP até 50 MB. Se não enviar uma imagem, será usada a capa predefinida.</p>
                  {uploading === 'cover' && <p role="status" className="text-sm text-gray-600">A enviar capa…</p>}
                  <Button type="button" variant="secondary" disabled={!formData.isbn || Boolean(uploading) || saving}
                    onClick={async () => {
                      setMediaError('');
                      setUploading('cover');
                      try {
                        const response = await fetch(`/api/books/cover?isbn=${encodeURIComponent(formData.isbn)}`);
                        const data = await response.json();
                        if (!response.ok || !data.url) throw new Error();
                        setFormData(prev => ({ ...prev, cover: data.url }));
                      } catch {
                        setMediaError('Não foi possível buscar a capa. Selecione uma imagem do dispositivo.');
                      } finally {
                        setUploading(null);
                      }
                    }}>
                    Buscar capa pelo ISBN
                  </Button>
                </div>
              </div>
            </div>
          )}

          {mediaError && <p role="alert" className="text-sm text-red-600">{mediaError}</p>}
          <div className="flex justify-end gap-4">
            <Button variant="secondary" type="button" onClick={() => navigate(-1)}>Cancelar</Button>
            <Button type="submit" disabled={Boolean(uploading) || saving}>{uploading ? 'A enviar ficheiro…' : saving ? 'A guardar…' : isEdit ? 'Guardar alterações' : 'Adicionar livro'}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default BookForm;
