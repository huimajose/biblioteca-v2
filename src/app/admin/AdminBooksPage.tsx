import { bookLabelLines, physicalCopyNumbers } from '@/utils/bookCatalog';
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, PlusCircle, FileDown, ChevronDown, Tags, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { BookInfoModal } from '@/components/BookInfoModal.tsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { LOGO_WATERMARK } from '@/constants.ts';
import { addCenteredWatermarkToAllPages, loadWatermarkImage } from '@/utils/pdfWatermark.ts';

export const AdminBooksPage = () => {
  const [books, setBooks] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [catalogCodeFilter, setCatalogCodeFilter] = useState('');
  const [armarioFilter, setArmarioFilter] = useState('all');
  const [prateleiraFilter, setPrateleiraFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'title' | 'author' | 'available' | 'created'>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [genres, setGenres] = useState<any[]>([]);
  const [genreFilter, setGenreFilter] = useState<string>('all');
  const [bookTypeFilter, setBookTypeFilter] = useState<'all' | 'physical' | 'digital'>('all');
  const [selectedBook, setSelectedBook] = useState<any | null>(null);
  const [deletingBookId, setDeletingBookId] = useState<number | null>(null);

  const getActorUserId = () =>
    typeof window !== 'undefined' ? window.localStorage.getItem('userId') || '' : '';

  const loadBooks = async () => {
    const res = await fetch('/api/books');
    const data = await res.json().catch(() => []);
    setBooks(Array.isArray(data) ? data : data?.data ?? []);
  };

  const getGenreOrder = (genreName: string) => {
    const match = genres.find((genre) => String(genre.name || '').toLowerCase() === String(genreName || '').toLowerCase());
    return Number(match?.displayOrder ?? Number.MAX_SAFE_INTEGER);
  };

  const getGenreCode = (genreName: string) => {
    const match = genres.find((genre) => String(genre.name || '').toLowerCase() === String(genreName || '').toLowerCase());
    return String(match?.code || 'CUR').trim().toUpperCase();
  };

  useEffect(() => {
    loadBooks().catch(() => setBooks([]));
    fetch('/api/genres')
      .then(res => res.json())
      .then(data => setGenres(Array.isArray(data) ? data : []))
      .catch(() => setGenres([]));
  }, []);

  const handleDeleteBook = async (book: any) => {
    if (deletingBookId) return;

    const confirmed = window.confirm(`Tem certeza que deseja apagar o livro "${book.title}"?`);
    if (!confirmed) return;

    setDeletingBookId(book.id);
    try {
      const res = await fetch(`/api/admin/books/${book.id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': getActorUserId() },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || 'Falha ao apagar o livro.');
        return;
      }

      setBooks((prev) => prev.filter((item) => item.id !== book.id));
      if (selectedBook?.id === book.id) {
        setSelectedBook(null);
      }
    } finally {
      setDeletingBookId(null);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [search, catalogCodeFilter, armarioFilter, prateleiraFilter, sortBy, sortOrder, genreFilter, bookTypeFilter]);

  const armarioOptions = useMemo(
    () =>
      Array.from(
        new Set(
          books
            .map((book) => String(book.armario || '').trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [books]
  );

  const prateleiraOptions = useMemo(
    () =>
      Array.from(
        new Set(
          books
            .map((book) => String(book.prateleira ?? '').trim())
            .filter(Boolean)
        )
      ).sort((a, b) => Number(a) - Number(b)),
    [books]
  );

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    const catalogQuery = catalogCodeFilter.toLowerCase();
    const list = books.filter((b) => {
      const title = String(b.title || '').toLowerCase();
      const author = String(b.author || '').toLowerCase();
      const isbn = String(b.isbn || '').toLowerCase();
      const catalogCode = String(b.catalogCode || '').toLowerCase();
      const matchesSearch = title.includes(query) || author.includes(query) || isbn.includes(query) || catalogCode.includes(query);
      const matchesCatalogCode = !catalogQuery || catalogCode.includes(catalogQuery);
      const matchesArmario = armarioFilter === 'all' || String(b.armario || '').trim() === armarioFilter;
      const matchesPrateleira = prateleiraFilter === 'all' || String(b.prateleira ?? '').trim() === prateleiraFilter;
      const isDigital = Boolean(b.isDigital || b.fileUrl);
      const matchesType = bookTypeFilter === 'all' ||
        (bookTypeFilter === 'digital' ? isDigital : !isDigital);
      return matchesSearch && matchesCatalogCode && matchesArmario && matchesPrateleira && matchesType;
    });
    const genreFiltered =
      genreFilter === 'all'
        ? list
        : list.filter((b) => String(b.genre || '').toLowerCase() === String(genreFilter).toLowerCase());
    const sorted = [...genreFiltered].sort((a, b) => {
      const dir = sortOrder === 'asc' ? 1 : -1;
      if (sortBy === 'available') {
        return ((a.availableCopies ?? 0) - (b.availableCopies ?? 0)) * dir;
      }
      if (sortBy === 'created') {
        return (new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()) * dir;
      }
      const av = (a[sortBy] || '').toString().toLowerCase();
      const bv = (b[sortBy] || '').toString().toLowerCase();
      return av.localeCompare(bv) * dir;
    });
    return sorted;
  }, [books, search, catalogCodeFilter, armarioFilter, prateleiraFilter, sortBy, sortOrder, genreFilter, bookTypeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const orderedInventoryBooks = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const genreOrderDiff = getGenreOrder(a.genre) - getGenreOrder(b.genre);
      if (genreOrderDiff !== 0) return genreOrderDiff;

      const genreNameDiff = String(a.genre || '').localeCompare(String(b.genre || ''));
      if (genreNameDiff !== 0) return genreNameDiff;

      const sequenceDiff = Number(a.courseSequence ?? Number.MAX_SAFE_INTEGER) - Number(b.courseSequence ?? Number.MAX_SAFE_INTEGER);
      if (sequenceDiff !== 0) return sequenceDiff;

      return String(a.title || '').localeCompare(String(b.title || ''));
    });
  }, [filtered, genres]);

  const exportInventoryPdf = async (byGenre: boolean) => {
    const doc = new jsPDF('p', 'pt');
    doc.setFontSize(16);
    doc.text('Inventário de Livros', 40, 40);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, 40, 58);

    if (byGenre) {
      const grouped: Record<string, any[]> = {};
      orderedInventoryBooks.forEach((b) => {
        const key = b.genre || 'Sem curso';
        grouped[key] = grouped[key] || [];
        grouped[key].push(b);
      });

      let y = 80;
      Object.entries(grouped).forEach(([genre, list]) => {
        doc.setFontSize(12);
        doc.text(`${getGenreCode(genre)} | ${genre} (${list.length} títulos; ${list.reduce((sum, book) => sum + Number(book.totalCopies || 0), 0)} exemplares)`, 40, y);
        y += 8;
        autoTable(doc, {
          startY: y + 8,
          head: [['Seq', 'Codigo', 'Titulo', 'Autor', 'ISBN', 'Disp. / Total']],
          body: list.map((b) => [
            b.courseSequence ?? '-',
            b.catalogCode || `${getGenreCode(genre)}-${String(b.courseSequence ?? '').padStart(3, '0')}`,
            b.title,
            b.author,
            b.isbn,
            `${b.availableCopies ?? 0} / ${b.totalCopies ?? 0}`,
          ]),
          styles: { fontSize: 9 },
          headStyles: { fillColor: [101, 163, 13] },
        });
        y = (doc as any).lastAutoTable.finalY + 20;
      });
    } else {
      autoTable(doc, {
        startY: 80,
        head: [['Curso', 'Seq', 'Codigo', 'Titulo', 'Autor', 'ISBN', 'Disp. / Total']],
        body: orderedInventoryBooks.map((b) => [
          getGenreCode(b.genre),
          b.courseSequence ?? '-',
          b.catalogCode || '-',
          b.title,
          b.author,
          b.isbn,
          `${b.availableCopies ?? 0} / ${b.totalCopies ?? 0}`,
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [101, 163, 13] },
      });
    }

    try {
      const logo = await loadWatermarkImage(LOGO_WATERMARK);
      addCenteredWatermarkToAllPages(doc, logo, { width: 160 });
    } catch {
      // ignore watermark if logo fails
    }

    doc.save(byGenre ? 'inventario-por-curso.pdf' : 'inventario-completo.pdf');
    setPdfOpen(false);
  };

  const exportInventoryExcel = (byGenre: boolean) => {
    const rows = byGenre
      ? (() => {
          const grouped: Record<string, any[]> = {};
          orderedInventoryBooks.forEach((b) => {
            const key = b.genre || 'Sem curso';
            grouped[key] = grouped[key] || [];
            grouped[key].push(b);
          });
          return Object.entries(grouped).flatMap(([genre, list]) =>
            list.map((b) => [`${genre} (${list.length} títulos; ${list.reduce((sum, book) => sum + Number(book.totalCopies || 0), 0)} exemplares)`, b.courseSequence ?? '-', b.catalogCode || '-', b.title, b.author, b.isbn, `${b.availableCopies ?? 0} / ${b.totalCopies ?? 0}`])
          );
        })()
      : orderedInventoryBooks.map((b) => [getGenreCode(b.genre), b.courseSequence ?? '-', b.catalogCode || '-', b.title, b.author, b.isbn, `${b.availableCopies ?? 0} / ${b.totalCopies ?? 0}`]);

    const header = byGenre
      ? [['Curso', 'Seq', 'Código', 'Título', 'Autor', 'ISBN', 'Disp. / Total']]
      : [['Curso', 'Seq', 'Código', 'Título', 'Autor', 'ISBN', 'Disp. / Total']];

    const worksheet = XLSX.utils.aoa_to_sheet([...header, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventario');
    XLSX.writeFile(workbook, byGenre ? 'inventario-por-curso.xlsx' : 'inventario-completo.xlsx');
    setPdfOpen(false);
  };

  const exportLabels = async (selectedBooks: any[], filename: string) => {
    const labels = selectedBooks.flatMap(book => physicalCopyNumbers(book).map(copy => ({ book, copy })));
    if (!labels.length) {
      alert('Não existem exemplares físicos para etiquetar.');
      return;
    }
    const doc = new jsPDF('p', 'pt', 'a4');
    labels.forEach(({ book, copy }, index) => {
      if (index > 0 && index % 10 === 0) doc.addPage();
      const position = index % 10;
      const x = 40 + (position % 2) * 240;
      const y = 40 + Math.floor(position / 2) * 145;
      doc.setDrawColor(0);
      doc.roundedRect(x, y, 220, 135, 4, 4);
      bookLabelLines(book, copy, getGenreCode(book.genre)).forEach((line, lineIndex) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(lineIndex === 0 ? 13 : lineIndex === 5 ? 10 : 16);
        doc.text(line, x + 110, y + 22 + lineIndex * 20, { align: 'center', maxWidth: 200 });
      });
      doc.line(x, y + 30, x + 220, y + 30);
    });
    doc.save(filename);
  };

  const exportLabelPdf = (book: any) => exportLabels([book], `etiquetas-${book.id}.pdf`);
  const exportAllLabelsPdf = () => exportLabels(filtered, 'etiquetas-livros.pdf');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestão de livros</h1>
          <p className="text-sm text-gray-500">Crie, edite e acompanhe o stock.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Button variant="secondary" className="flex items-center gap-2" onClick={() => setPdfOpen(!pdfOpen)}>
              <FileDown className="w-4 h-4" />
              
              <ChevronDown className="w-4 h-4" />
            </Button>
            {pdfOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 shadow-lg rounded-xl overflow-hidden z-10">
                <button
                  className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50"
                  onClick={() => exportInventoryPdf(false)}
                >
                  Inventário completo (PDF)
                </button>
                <button
                  className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50"
                  onClick={() => exportInventoryPdf(true)}
                >
                  Inventário por curso (PDF)
                </button>
                <button
                  className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50"
                  onClick={() => exportInventoryExcel(false)}
                >
                  Inventário completo (Excel)
                </button>
                <button
                  className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50"
                  onClick={() => exportInventoryExcel(true)}
                >
                  Inventário por curso (Excel)
                </button>

                <button className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50" onClick={exportAllLabelsPdf}>
                  Imprimir etiquetas (todos)
                </button>
              </div>
            )}
          </div>
          <Link to="/admin/books/new">
            <Button className="flex items-center gap-2">
              <PlusCircle className="w-4 h-4" />
              Novo
            </Button>
          </Link>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <input
            className="px-4 py-2 border rounded-lg"
            placeholder="Pesquisar por título, autor ou ISBN"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <input
            className="px-4 py-2 border rounded-lg font-mono"
            placeholder="Filtrar por catálogo"
            value={catalogCodeFilter}
            onChange={(e) => { setCatalogCodeFilter(e.target.value); setPage(1); }}
          />
          <select className="px-4 py-2 border rounded-lg" value={armarioFilter} onChange={(e) => { setArmarioFilter(e.target.value); setPage(1); }}>
            <option value="all">Todos os armários</option>
            {armarioOptions.map((armario) => (
              <option key={armario} value={armario}>Armário {armario}</option>
            ))}
          </select>
          <select className="px-4 py-2 border rounded-lg" value={prateleiraFilter} onChange={(e) => { setPrateleiraFilter(e.target.value); setPage(1); }}>
            <option value="all">Todas prateleiras</option>
            {prateleiraOptions.map((prateleira) => (
              <option key={prateleira} value={prateleira}>Prateleira {prateleira}</option>
            ))}
          </select>
          <select
            aria-label="Tipo de livro"
            className="px-4 py-2 border rounded-lg"
            value={bookTypeFilter}
            onChange={(e) => { setBookTypeFilter(e.target.value as 'all' | 'physical' | 'digital'); setPage(1); }}
          >
            <option value="all">Todos os tipos</option>
            <option value="physical">Físico</option>
            <option value="digital">Digital</option>
          </select>
          <select className="px-4 py-2 border rounded-lg" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="title">Ordenar por título</option>
            <option value="author">Ordenar por autor</option>
            <option value="available">Ordenar por disponíveis</option>
            <option value="created">Ordenar por data</option>
          </select>
          <select className="px-4 py-2 border rounded-lg" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as any)}>
            <option value="asc">Ascendente</option>
            <option value="desc">Descendente</option>
          </select>
          <select className="px-4 py-2 border rounded-lg" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            {[10, 20, 30, 50].map(size => (
              <option key={size} value={size}>{size} por página</option>
            ))}
          </select>
          <select className="px-4 py-2 border rounded-lg" value={genreFilter} onChange={(e) => { setGenreFilter(e.target.value); setPage(1); }}>
            <option value="all">Todos cursos</option>
            {genres.map((g) => (
              <option key={g.id} value={g.name}>{g.name}</option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <p className="border-b p-4 text-sm text-gray-600">
          {filtered.length} títulos · {filtered.reduce((sum, book) => sum + Number(book.totalCopies || 0), 0)} exemplares físicos · {filtered.reduce((sum, book) => sum + Number(book.availableCopies || 0), 0)} disponíveis
        </p>
        <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full text-left border-collapse">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-4 text-xs uppercase text-gray-400">Título</th>
              <th className="p-4 text-xs uppercase text-gray-400">Autor</th>
              <th className="p-4 text-xs uppercase text-gray-400">ISBN</th>
              <th className="p-4 text-xs uppercase text-gray-400">Tipo</th>
              <th className="p-4 text-xs uppercase text-gray-400 text-right">Disponível</th>
              <th className="p-4 text-xs uppercase text-gray-400 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-sm text-gray-400">
                  Nenhum livro encontrado.
                </td>
              </tr>
            ) : (
              paged.map((book) => (
                <tr
                  key={book.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedBook(book)}
                >
                  <td className="p-4 text-sm font-semibold">{book.title}</td>
                  <td className="p-4 text-sm text-gray-600">{book.author}</td>
                  <td className="p-4 text-xs font-mono text-gray-400">{book.isbn}</td>
                  <td className="p-4 text-xs">
                    {book.isDigital && (book.totalCopies ?? 0) > 0 ? 'Digital + Físico' : (book.isDigital ? 'Digital' : 'Físico')}
                  </td>
                  <td className="p-4 text-sm text-right font-mono">
                    {`${book.availableCopies ?? 0} / ${book.totalCopies ?? 0}${book.isDigital ? ' + digital' : ''}`}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="secondary"
                        className="inline-flex items-center gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          exportLabelPdf(book);
                        }}
                      >
                        <Tags className="w-4 h-4" />
                        
                      </Button>
                      <Link to={`/admin/books/edit?id=${book.id}`} onClick={(e) => e.stopPropagation()}>
                        <Button variant="secondary" className="inline-flex items-center gap-2">
                          <Pencil className="w-4 h-4" />
                          
                        </Button>
                      </Link>
                      <Button
                        variant="danger"
                        className="inline-flex items-center gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBook(book);
                        }}
                        disabled={deletingBookId === book.id}
                      >
                        <Trash2 className="w-4 h-4" />
                        {deletingBookId === book.id ? 'A apagar...' : ''}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </Card>

      {selectedBook && (
        <BookInfoModal book={selectedBook} onClose={() => setSelectedBook(null)} />
      )}

      <div className="flex flex-col gap-3 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
        <span>Página {page} de {totalPages}</span>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Anterior</Button>
          <Button variant="secondary" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Seguinte</Button>
        </div>
      </div>
    </div>
  );
};
