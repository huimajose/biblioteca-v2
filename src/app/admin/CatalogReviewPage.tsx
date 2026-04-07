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
  | 'missing-cdu'
  | 'duplicate-isbn'
  | 'duplicate-title-author';

const ISSUE_LABELS: Record<ReviewIssue, string> = {
  general: 'Curso Geral',
  'missing-genre': 'Sem curso',
  'missing-catalog': 'Sem catalogo',
  'missing-armario': 'Sem armario',
  'missing-prateleira': 'Sem prateleira',
  'missing-isbn': 'Sem ISBN',
  'missing-editora': 'Sem editora',
  'missing-cdu': 'Sem CDU',
  'duplicate-isbn': 'ISBN duplicado',
  'duplicate-title-author': 'Titulo/autor parecido',
};

const normalizeText = (value: string | null | undefined) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getTitleSimilarity = (left: string, right: string) => {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.9;
  const leftTokens = new Set(left.split(' ').filter(Boolean));
  const rightTokens = new Set(right.split(' ').filter(Boolean));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
};

const getBaseBookIssues = (book: any): ReviewIssue[] => {
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

  const duplicateInfo = useMemo(() => {
    const isbnGroups = new Map<string, any[]>();
    const probableGroups: any[][] = [];
    const duplicateById = new Map<number, Set<ReviewIssue>>();

    books.forEach((book) => {
      const isbnKey = normalizeText(book.isbn);
      if (!isbnKey) return;
      const current = isbnGroups.get(isbnKey) || [];
      current.push(book);
      isbnGroups.set(isbnKey, current);
    });

    isbnGroups.forEach((group) => {
      if (group.length < 2) return;
      group.forEach((book) => {
        const issues = duplicateById.get(book.id) || new Set<ReviewIssue>();
        issues.add('duplicate-isbn');
        duplicateById.set(book.id, issues);
      });
    });

    const booksByAuthor = new Map<string, any[]>();
    books.forEach((book) => {
      const authorKey = normalizeText(book.author);
      if (!authorKey) return;
      const current = booksByAuthor.get(authorKey) || [];
      current.push(book);
      booksByAuthor.set(authorKey, current);
    });

    booksByAuthor.forEach((group) => {
      if (group.length < 2) return;
      const visited = new Set<number>();
      for (let i = 0; i < group.length; i += 1) {
        if (visited.has(group[i].id)) continue;
        const titleA = normalizeText(group[i].title);
        const cluster = [group[i]];
        for (let j = i + 1; j < group.length; j += 1) {
          const titleB = normalizeText(group[j].title);
          const similarity = getTitleSimilarity(titleA, titleB);
          if (similarity >= 0.75) {
            cluster.push(group[j]);
            visited.add(group[j].id);
          }
        }
        if (cluster.length > 1) {
          probableGroups.push(cluster);
          cluster.forEach((book) => {
            const issues = duplicateById.get(book.id) || new Set<ReviewIssue>();
            issues.add('duplicate-title-author');
            duplicateById.set(book.id, issues);
          });
        }
      }
    });

    return {
      duplicateById,
      duplicateIsbnGroups: Array.from(isbnGroups.values()).filter((group) => group.length > 1),
      probableGroups,
    };
  }, [books]);

  const reviewBooks = useMemo(() => {
    const query = search.toLowerCase();
    return books
      .map((book) => {
        const baseIssues = getBaseBookIssues(book);
        const duplicateIssues = Array.from(duplicateInfo.duplicateById.get(book.id) || []);
        return { ...book, reviewIssues: [...new Set([...baseIssues, ...duplicateIssues])] };
      })
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
  }, [books, search, issueFilter, duplicateInfo]);

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
        <Card className="p-5">
          <p className="text-xs uppercase text-gray-400">ISBN duplicado</p>
          <p className="mt-2 text-3xl font-black">{summary['duplicate-isbn'] || 0}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase text-gray-400">Titulo/autor parecido</p>
          <p className="mt-2 text-3xl font-black">{summary['duplicate-title-author'] || 0}</p>
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-rose-50">
            <h2 className="text-sm font-bold text-rose-700 uppercase tracking-wider">Grupos com ISBN duplicado</h2>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {duplicateInfo.duplicateIsbnGroups.length === 0 ? (
              <p className="p-6 text-sm text-gray-400">Nenhum duplicado por ISBN encontrado.</p>
            ) : (
              duplicateInfo.duplicateIsbnGroups.slice(0, 12).map((group, index) => (
                <div key={`isbn-${index}`} className="p-4">
                  <p className="text-xs font-bold text-rose-700">ISBN {group[0]?.isbn || 'N/D'}</p>
                  <div className="mt-3 space-y-2">
                    {group.map((book) => (
                      <button key={book.id} className="w-full rounded-xl border border-gray-100 px-3 py-2 text-left hover:bg-gray-50" onClick={() => setSelectedBook(book)}>
                        <p className="text-sm font-semibold">{book.title}</p>
                        <p className="text-xs text-gray-500">{book.author || 'Autor em falta'} | ID {book.id}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-amber-50">
            <h2 className="text-sm font-bold text-amber-700 uppercase tracking-wider">Titulo parecido e mesmo autor</h2>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {duplicateInfo.probableGroups.length === 0 ? (
              <p className="p-6 text-sm text-gray-400">Nenhum duplicado provavel por titulo/autor.</p>
            ) : (
              duplicateInfo.probableGroups.slice(0, 12).map((group, index) => (
                <div key={`probable-${index}`} className="p-4">
                  <p className="text-xs font-bold text-amber-700">{group[0]?.author || 'Autor em falta'}</p>
                  <div className="mt-3 space-y-2">
                    {group.map((book) => (
                      <button key={book.id} className="w-full rounded-xl border border-gray-100 px-3 py-2 text-left hover:bg-gray-50" onClick={() => setSelectedBook(book)}>
                        <p className="text-sm font-semibold">{book.title}</p>
                        <p className="text-xs text-gray-500">{book.catalogCode || 'Sem catalogo'} | ID {book.id}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

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
