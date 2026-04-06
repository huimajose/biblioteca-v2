import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { resolveBookFileFallback } from '@/utils/file.ts';
import { PdfViewer } from '@/components/PdfViewer.tsx';
import { User } from '@/hooks/useAuth.ts';
import { Toast } from '@/components/Toast.tsx';

interface PdfReaderPageProps {
  user: User;
}

export const PdfReaderPage = ({ user }: PdfReaderPageProps) => {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialPage, setInitialPage] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [inShelf, setInShelf] = useState(false);
  const [previewLimit, setPreviewLimit] = useState(5);
  const [showUnlockPrompt, setShowUnlockPrompt] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [progressReady, setProgressReady] = useState(false);
  const [toast, setToast] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    if (!bookId) return;
    setLoading(true);
    setProgressReady(false);
    setShowUnlockPrompt(false);
    setToast(null);
    Promise.all([
      fetch(`/api/books/${bookId}`).then((res) => res.json()),
      fetch(`/api/user/reading-progress?bookId=${bookId}`, {
        headers: { 'x-user-id': user.id },
      })
        .then((res) => res.json())
        .catch(() => ({ progress: null, inShelf: false, previewLimit: 5 })),
    ])
      .then(([bookData, progressData]) => {
        setBook(bookData);
        const savedPage = Math.max(1, Number(progressData?.progress?.currentPage || 1));
        setInitialPage(savedPage);
        setCurrentPage(savedPage);
        setTotalPages(Math.max(0, Number(progressData?.progress?.totalPages || 0)));
        setInShelf(Boolean(progressData?.inShelf));
        setPreviewLimit(Math.max(1, Number(progressData?.previewLimit || 5)));
      })
      .finally(() => {
        setProgressReady(true);
        setLoading(false);
      });
  }, [bookId, user.id]);

  useEffect(() => {
    if (!bookId || !progressReady || totalPages <= 0 || currentPage <= 0) return;
    const timeout = window.setTimeout(() => {
      fetch('/api/user/reading-progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({
          bookId: Number(bookId),
          currentPage,
          totalPages,
        }),
      }).catch(() => null);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [bookId, currentPage, progressReady, totalPages, user.id]);

  const { primary, fallback } = resolveBookFileFallback(book?.fileUrl, book?.id);
  const watermarkText = useMemo(() => {
    const name = user.fullName || user.email || user.id;
    const date = new Date().toLocaleString();
    return `${name} - ${date}`;
  }, [user.fullName, user.email, user.id]);

  const handleUnlock = async () => {
    if (!bookId || unlocking) return;
    setUnlocking(true);
    try {
      const res = await fetch(`/api/books/${bookId}/add-to-shelf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setInShelf(true);
        setShowUnlockPrompt(false);
        setToast({
          title: 'Livro desbloqueado',
          message: 'Adicionado a estante. Agora pode continuar a leitura.',
        });
        return;
      }

      if (String(data?.message || '').toLowerCase().includes('ja existe')) {
        setInShelf(true);
        setShowUnlockPrompt(false);
        return;
      }

      setToast({
        title: 'Falha ao desbloquear',
        message: data?.message || 'Nao foi possivel adicionar o livro a estante.',
      });
    } finally {
      setUnlocking(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => navigate(-1)} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
          <h1 className="text-xl font-bold">Leitor PDF</h1>
        </div>
        <Card className="p-10 text-center text-gray-400">A carregar...</Card>
      </div>
    );
  }

  if (!book || (!primary && !fallback)) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => navigate(-1)} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
          <h1 className="text-xl font-bold">Leitor PDF</h1>
        </div>
        <Card className="p-10 text-center text-gray-500">
          PDF indisponivel no momento. Verifique se o ficheiro foi enviado corretamente ou tente mais tarde.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={() => navigate(-1)} className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <h1 className="text-xl font-bold">Leitor PDF</h1>
      </div>

      {!inShelf && (
        <Card className="p-4 border border-amber-200 bg-amber-50">
          <p className="text-sm font-semibold text-amber-900">
            Pre-visualizacao ativa: pode ler ate a pagina {previewLimit} antes de adicionar este livro a estante.
          </p>
        </Card>
      )}

      <Card className="overflow-hidden">
        <PdfViewer
          url={primary}
          fallbackUrl={fallback}
          watermarkText={`${watermarkText} - NAO COPIAR`}
          initialPage={initialPage}
          maxAccessiblePage={inShelf ? null : previewLimit}
          onDocumentLoad={(pages) => setTotalPages(pages)}
          onPageChange={(page, pages) => {
            setCurrentPage(page);
            if (pages > 0) setTotalPages(pages);
          }}
          onBlockedPageAttempt={() => setShowUnlockPrompt(true)}
        />
        <div className="p-3 border-t border-gray-100 bg-white text-[10px] text-gray-400">
          Este leitor bloqueia download direto. Capturas de ecra ainda sao possiveis no dispositivo do utilizador.
        </div>
      </Card>

      {showUnlockPrompt && !inShelf && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold">Continuar a leitura</h2>
              <p className="text-sm text-gray-500 mt-1">
                Ja leu {previewLimit} paginas. Para continuar, adicione este livro a sua estante digital.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setShowUnlockPrompt(false)}>
                Agora nao
              </Button>
              <Button className="flex-[2]" onClick={handleUnlock} disabled={unlocking}>
                {unlocking ? 'A processar...' : 'Adicionar a estante'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <Toast title={toast.title} message={toast.message} onClose={() => setToast(null)} />
        </div>
      )}
    </div>
  );
};
