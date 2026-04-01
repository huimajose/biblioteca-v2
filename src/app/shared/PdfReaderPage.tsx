import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { DEFAULT_BOOK_COVER } from '@/constants.ts';
import { resolveBookFileFallback } from '@/utils/file.ts';
import { PdfViewer } from '@/components/PdfViewer.tsx';
import { User } from '@/hooks/useAuth.ts';

interface PdfReaderPageProps {
  user: User;
}

export const PdfReaderPage = ({ user }: PdfReaderPageProps) => {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookId) return;
    setLoading(true);
    fetch(`/api/books/${bookId}`)
      .then((res) => res.json())
      .then((data) => setBook(data))
      .finally(() => setLoading(false));
  }, [bookId]);

  const { primary, fallback } = resolveBookFileFallback(book?.fileUrl, book?.id);
  const watermarkText = useMemo(() => {
    const name = user.fullName || user.email || user.id;
    const date = new Date().toLocaleString();
    return `${name} � ${date}`;
  }, [user.fullName, user.email, user.id]);

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


      <Card className="overflow-hidden">
        <PdfViewer
          url={primary}
          fallbackUrl={fallback}
          watermarkText={`${watermarkText} � NAO COPIAR`}
        />
        <div className="p-3 border-t border-gray-100 bg-white text-[10px] text-gray-400">
          Este leitor bloqueia download direto. Capturas de ecra ainda sao possiveis no dispositivo do utilizador.
        </div>
      </Card>
    </div>
  );
};
