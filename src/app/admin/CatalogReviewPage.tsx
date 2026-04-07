import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BookOpenCheck, Filter, Pencil } from 'lucide-react';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { BookInfoModal } from '@/components/BookInfoModal.tsx';

type ReviewIssue =
  | 'general'
  | 'missing-genre'
  | 'missing-catalog'
  | 'missing-armario'
  | 'missing-prateleira'
  | 'missing-isbn'
  | 'missing-editora'
  | 'missing-cdu';

const ISSUE_LABELS: Record<ReviewIssue, string> = {
  general: 'Curso Geral',
  'missing-genre': 'Sem curso',
  'missing-catalog': 'Sem catalogo',
  'missing-armario': 'Sem armario',
  'missing-prateleira': 'Sem prateleira',
  'missing-isbn': 'Sem ISBN',
  'missing-editora': 'Sem editora',
  'missing-cdu': 'Sem CDU',
};

const getBookIssues = (book: any): ReviewIssue[] => {
  const issues: ReviewIssue[] = [];
  const genre = String(book.genre || '').trim();
  if (!genre) issues.push('missing-genre');
  if (genre.toLowerCase() === 'geral') issues.push('general');
  if (!String(book.catalogCode || '').trim()) issues.push('missing-catalog');
  if (!String(book.armario || '').trim()) issues.push('missing-armario');
  if (book.prateleira === null || book.prateleira === undefined || String(book.prateleira).trim() === '') issues.push('missing-prateleira');
  if (!String(book.isbn || '').trim()) issues.push('missing-isbn');
  if (!String(book.editora || '').trim()) issues.push('missing-editora');
  if (!String(book.cdu || '').trim()) issues.push('missing-cdu');
  return issues;
};

export const CatalogReviewPage = () => {
  const [books, setBooks] = useState<any[]>([]);
  const [selectedBook, setSelectedBook] = useState<any | null>(null);
  const [search, setSearch] = useState('');
  const [issueFilter, setIssueFilter] = useState<'all' | ReviewIssue>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  useEffect(() => {
    fetch('/api/books')
      .then((res) => res.json())
      .then((data) => setBooks(Array.isArray(data) ? data : data?.data ?? []))
      .catch(() => setBooks([]));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, issueFilter, pageSize]);

  const reviewBooks = useMemo(() => {
    const query = search.toLowerCase();
    return books
      .map((book) => ({ ...book, reviewIssues: getBookIssues(book) }))
      .filter((book) => book.reviewIssues.length > 0)
      .filter((book) => {
        const matchesIssue = issueFilter === 'all' || book.reviewIssues.includes(issueFilter);
        const matchesSearch = !query || [
          book.title,
          book.author,
          book.genre,
          book.isbn,
          book.catalogCode,
          book.armario,
          book.prateleira,
        ].some((value) => String(value || '').toLowerCase().includes(query));
        return matchesIssue && matchesSearch;
      })
      .sort((a, b) => {
        const issueDiff = b.reviewIssues.length - a.reviewIssues.length;
        if (issueDiff !== 0) return issueDiff;
        return String(a.title || '').localeCompare(String(b.title || ''));
      });
  }, [books, search, issueFilter]);

  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    reviewBooks.forEach((book) => {
      book.reviewIssues.forEach((issue: ReviewIssue) => {
        counts[issue] = (counts[issue] || 0) + 1;
      });
    });
    return counts;
  }, [reviewBooks]);

  const totalPages = Math.max(1, Math.ceil(reviewBooks.length / pageSize));
  const paged = reviewBooks.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Revisao do acervo</h1>
          <p className="text-sm text-gray-500">Encontre livros em Geral, sem curso ou com metadados incompletos.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/books">
            <Button variant="secondary" className="inline-flex items-center gap-2">
              <BookOpenCheck className="w-4 h-4" />
              Voltar aos livros
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-5">
          <p className="text-xs uppercase text-gray-400">Livros a rever</p>
          <p className="mt-2 text-3xl font-black">{reviewBooks.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase text-gray-400">Curso Geral</p>
          <p className="mt-2 text-3xl font-black">{summary.general || 0}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase text-gray-400">Sem curso</p>
          <p className="mt-2 text-3xl font-black">{summary['missing-genre'] || 0}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase text-gray-400">Sem catalogo</p>
          <p className="mt-2 text-3xl font-black">{summary['missing-catalog'] || 0}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_160px] gap-3">
          <input
            className="px-4 py-2 border rounded-lg"
            placeholder="Pesquisar por titulo, autor, curso, ISBN ou catalogo"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="px-4 py-2 border rounded-lg" value={issueFilter} onChange={(e) => setIssueFilter(e.target.value as 'all' | ReviewIssue)}>
            <option value="all">Todos os problemas</option>
            {Object.entries(ISSUE_LABELS).map(([issue, label]) => (
              <option key={issue} value={issue}>{label}</option>
            ))}
          </select>
          <select className="px-4 py-2 border rounded-lg" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            {[15, 30, 50].map((size) => (
              <option key={size} value={size}>{size} por pagina</option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          {Object.entries(ISSUE_LABELS).map(([issue, label]) => (
            <button
              key={issue}
              className={`rounded-full px-3 py-2 text-xs font-bold transition-colors ${
                issueFilter === issue
                  ? 'bg-lime-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              onClick={() => setIssueFilter(issue as ReviewIssue)}
            >
              <Filter className="mr-2 inline-block w-3 h-3" />
              {label}: {summary[issue] || 0}
            </button>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-4 text-xs uppercase text-gray-400">Livro</th>
              <th className="p-4 text-xs uppercase text-gray-400">Curso</th>
              <th className="p-4 text-xs uppercase text-gray-400">Catalogo</th>
              <th className="p-4 text-xs uppercase text-gray-400">Localizacao</th>
              <th className="p-4 text-xs uppercase text-gray-400">Problemas</th>
              <th className="p-4 text-xs uppercase text-gray-400 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-sm text-gray-400">
                  Nenhum livro pendente de revisao.
                </td>
              </tr>
            ) : (
              paged.map((book) => (
                <tr key={book.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedBook(book)}>
                  <td className="p-4">
                    <p className="text-sm font-semibold">{book.title}</p>
                    <p className="text-xs text-gray-500">{book.author || 'Autor em falta'}</p>
                  </td>
                  <td className="p-4 text-sm">{book.genre || 'Sem curso'}</td>
                  <td className="p-4 text-xs font-mono text-gray-500">{book.catalogCode || 'Sem catalogo'}</td>
                  <td className="p-4 text-xs text-gray-500">
                    ARM {book.armario || '-'} | PRAT {book.prateleira ?? '-'}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {book.reviewIssues.map((issue: ReviewIssue) => (
                        <span key={issue} className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
                          <AlertTriangle className="mr-1 inline-block w-3 h-3" />
                          {ISSUE_LABELS[issue]}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <Link to={`/admin/books/edit?id=${book.id}`} onClick={(e) => e.stopPropagation()}>
                      <Button variant="secondary" className="inline-flex items-center gap-2">
                        <Pencil className="w-4 h-4" />
                        Editar
                      </Button>
                    </Link>
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
          <Button variant="secondary" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Anterior</Button>
          <Button variant="secondary" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>Seguinte</Button>
        </div>
      </div>

      {selectedBook && (
        <BookInfoModal book={selectedBook} onClose={() => setSelectedBook(null)} />
      )}
    </div>
  );
};

export default CatalogReviewPage;
