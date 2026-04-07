import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, PlusCircle, FileDown, ChevronDown, Tags } from 'lucide-react';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { BookInfoModal } from '@/components/BookInfoModal.tsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { LOGO_WATERMARK } from '@/constants.ts';
import { addCenteredWatermarkToAllPages, loadWatermarkImage } from '@/utils/pdfWatermark.ts';

const getBookLocationLabel = (book: any) => {
  const armario = String(book.armario ?? book.cdu ?? '').trim() || 'S/ARM';
  const prateleira = String(book.prateleira ?? '').trim() || 'S/PRAT';
  const code = String(book.catalogCode ?? '').trim() || `ID ${book.id}`;
  return `ARM ${armario} | PRAT ${prateleira} | ${code}`;
};

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
  const [selectedBook, setSelectedBook] = useState<any | null>(null);

  const getGenreOrder = (genreName: string) => {
    const match = genres.find((genre) => String(genre.name || '').toLowerCase() === String(genreName || '').toLowerCase());
    return Number(match?.displayOrder ?? Number.MAX_SAFE_INTEGER);
  };

  const getGenreCode = (genreName: string) => {
    const match = genres.find((genre) => String(genre.name || '').toLowerCase() === String(genreName || '').toLowerCase());
    return String(match?.code || 'CUR').trim().toUpperCase();
  };

  useEffect(() => {
    fetch('/api/books')
      .then(res => res.json())
      .then(data => setBooks(Array.isArray(data) ? data : data?.data ?? []));
    fetch('/api/genres')
      .then(res => res.json())
      .then(data => setGenres(Array.isArray(data) ? data : []))
      .catch(() => setGenres([]));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, catalogCodeFilter, armarioFilter, prateleiraFilter, sortBy, sortOrder, genreFilter]);

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
      return matchesSearch && matchesCatalogCode && matchesArmario && matchesPrateleira;
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
  }, [books, search, catalogCodeFilter, armarioFilter, prateleiraFilter, sortBy, sortOrder, genreFilter]);

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
    doc.text('Inventario de Livros', 40, 40);
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
        doc.text(`${getGenreCode(genre)} | ${genre}`, 40, y);
        y += 8;
        autoTable(doc, {
          startY: y + 8,
          head: [['Seq', 'Codigo', 'Titulo', 'Autor', 'ISBN', 'Disponivel']],
          body: list.map((b) => [
            b.courseSequence ?? '-',
            b.catalogCode || `${getGenreCode(genre)}-${String(b.courseSequence ?? '').padStart(3, '0')}`,
            b.title,
            b.author,
            b.isbn,
            b.isDigital ? '-' : `${b.availableCopies}`,
          ]),
          styles: { fontSize: 9 },
          headStyles: { fillColor: [101, 163, 13] },
        });
        y = (doc as any).lastAutoTable.finalY + 20;
      });
    } else {
      autoTable(doc, {
        startY: 80,
        head: [['Curso', 'Seq', 'Codigo', 'Titulo', 'Autor', 'ISBN', 'Disponivel']],
        body: orderedInventoryBooks.map((b) => [
          getGenreCode(b.genre),
          b.courseSequence ?? '-',
          b.catalogCode || '-',
          b.title,
          b.author,
          b.isbn,
          b.isDigital ? '-' : `${b.availableCopies}`,
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
      ? orderedInventoryBooks.flatMap((b) => [[b.genre || 'Sem curso', b.courseSequence ?? '-', b.catalogCode || '-', b.title, b.author, b.isbn, b.isDigital ? '-' : `${b.availableCopies}`]])
      : orderedInventoryBooks.map((b) => [getGenreCode(b.genre), b.courseSequence ?? '-', b.catalogCode || '-', b.title, b.author, b.isbn, b.isDigital ? '-' : `${b.availableCopies}`]);

    const header = byGenre
      ? [['curso', 'Seq', 'Codigo', 'Titulo', 'Autor', 'ISBN', 'Disponivel']]
      : [['Curso', 'Seq', 'Codigo', 'Titulo', 'Autor', 'ISBN', 'Disponivel']];

    const worksheet = XLSX.utils.aoa_to_sheet([...header, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventario');
    XLSX.writeFile(workbook, byGenre ? 'inventario-por-curso.xlsx' : 'inventario-completo.xlsx');
    setPdfOpen(false);
  };

  const drawBarcode = (doc: jsPDF, x: number, y: number, width: number, height: number, seed: string) => {
    const data = seed.replace(/\D/g, '') || '1234567890';
    const totalBars = 60;
    const barWidth = width / totalBars;
    for (let i = 0; i < totalBars; i++) {
      const digit = parseInt(data[i % data.length], 10);
      if (digit % 2 === 0) {
        doc.rect(x + i * barWidth, y, barWidth * 0.7, height, 'F');
      }
    }
  };

  const drawLabel = (doc: jsPDF, x: number, y: number, book: any, watermark?: HTMLImageElement) => {
    const labelW = 180;
    const labelH = 120;
    const locationLabel = getBookLocationLabel(book);

    doc.setDrawColor(20);
    doc.setLineWidth(0.6);
    doc.roundedRect(x, y, labelW, labelH, 4, 4);

    if (watermark) {
      const wmW = 80;
      const wmH = wmW * (watermark.height / watermark.width);
      const wmX = x + (labelW - wmW) / 2;
      const wmY = y + (labelH - wmH) / 2;
      if ((doc as any).GState && doc.setGState) {
        doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
      }
      doc.addImage(watermark, 'PNG', wmX, wmY, wmW, wmH);
      if ((doc as any).GState && doc.setGState) {
        doc.setGState(new (doc as any).GState({ opacity: 1 }));
      }
    }

    doc.setFillColor(101, 163, 13);
    doc.rect(x, y, labelW, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Biblioteca Digital', x + 8, y + 12);

    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    
    doc.setFontSize(8);
    doc.text(locationLabel, x + 8, y + 38, { maxWidth: labelW - 16 });

    doc.setFont('helvetica', 'normal');
    const leftX = x + 8;
    const rightX = x + 110;
    doc.setDrawColor(230);
    doc.line(x + 8, y + 44, x + labelW - 8, y + 44);
    doc.line(x + 104, y + 50, x + 104, y + 84);

    const rawTitle = String(book.title || 'N/D');
    const rawAuthor = String(book.author || 'N/D');

    const fitText = (text: string, maxWidth: number, maxLines: number, startSize: number, minSize: number) => {
      let size = startSize;
      let lines = doc.splitTextToSize(text, maxWidth);
      while ((lines.length > maxLines) && size > minSize) {
        size -= 1;
        doc.setFontSize(size);
        lines = doc.splitTextToSize(text, maxWidth);
      }
      return { size, lines: lines.slice(0, maxLines) };
    };

    doc.setFontSize(7);
   

    const titleFit = fitText(rawTitle, 88, 2, 9, 7);
    doc.setFontSize(titleFit.size);
    const titleStartY = y + 62;
    doc.text(titleFit.lines, leftX, titleStartY);

    const titleLineCount = titleFit.lines.length;
    const authorLabelY = titleStartY + titleLineCount * 10 + 6;
    const authorValueY = Math.min(authorLabelY + 10, y + 84);
    doc.setFontSize(7);
   
    const authorFit = fitText(rawAuthor, 88, 1, 9, 7);
    doc.setFontSize(authorFit.size);
    doc.text(authorFit.lines, leftX, authorValueY);

    doc.setFontSize(7);
   
    doc.setFontSize(8);
    doc.text(String(book.genre || 'N/D'), rightX, y + 62, { maxWidth: 60 });

    doc.setFontSize(7);
   
    doc.setFontSize(8);
    doc.text(`${String(book.isbn || 'N/D')}`, rightX, y + 84, { maxWidth: 60 });

    drawBarcode(doc, x + 8, y + 92, 160, 10, `${locationLabel}${book.isbn || ''}`);
    doc.setFontSize(7);
   
  };

  const exportLabelPdf = async (book: any) => {
    const doc = new jsPDF('p', 'pt', 'a4');
    try {
      const logo = await loadWatermarkImage(LOGO_WATERMARK);
      drawLabel(doc, 40, 40, book, logo);
    } catch {
      drawLabel(doc, 40, 40, book);
    }
    doc.save(`etiqueta-${book.id}.pdf`);
  };

  const exportAllLabelsPdf = async () => {
    const doc = new jsPDF('p', 'pt', 'a4');
    const cols = 2;
    const rows = 5;
    const startX = 40;
    const startY = 40;
    const gapX = 10;
    const gapY = 10;
    const labelW = 180;
    const labelH = 120;
    let index = 0;

    let logo: HTMLImageElement | null = null;
    try {
      logo = await loadWatermarkImage(LOGO_WATERMARK);
    } catch {
      logo = null;
    }

    filtered.forEach((book) => {
      const pageIndex = Math.floor(index / (cols * rows));
      if (index > 0 && index % (cols * rows) === 0) {
        doc.addPage();
      }
      const pos = index % (cols * rows);
      const col = pos % cols;
      const row = Math.floor(pos / cols);
      const x = startX + col * (labelW + gapX);
      const y = startY + row * (labelH + gapY);
      drawLabel(doc, x, y, book, logo || undefined);
      index += 1;
    });

    doc.save('etiquetas-livros.pdf');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestao de livros</h1>
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
                  Inventario completo (PDF)
                </button>
                <button
                  className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50"
                  onClick={() => exportInventoryPdf(true)}
                >
                  Inventario por curso (PDF)
                </button>
                <button
                  className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50"
                  onClick={() => exportInventoryExcel(false)}
                >
                  Inventario completo (Excel)
                </button>
                <button
                  className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50"
                  onClick={() => exportInventoryExcel(true)}
                >
                  Inventario por curso (Excel)
                </button>

                 <button  className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50" onClick={exportAllLabelsPdf}>
          Imprimir Etiquetas (todos)
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
            placeholder="Pesquisar por titulo, autor ou ISBN"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <input
            className="px-4 py-2 border rounded-lg font-mono"
            placeholder="Filtrar por catalogo"
            value={catalogCodeFilter}
            onChange={(e) => { setCatalogCodeFilter(e.target.value); setPage(1); }}
          />
          <select className="px-4 py-2 border rounded-lg" value={armarioFilter} onChange={(e) => { setArmarioFilter(e.target.value); setPage(1); }}>
            <option value="all">Todos armarios</option>
            {armarioOptions.map((armario) => (
              <option key={armario} value={armario}>Armario {armario}</option>
            ))}
          </select>
          <select className="px-4 py-2 border rounded-lg" value={prateleiraFilter} onChange={(e) => { setPrateleiraFilter(e.target.value); setPage(1); }}>
            <option value="all">Todas prateleiras</option>
            {prateleiraOptions.map((prateleira) => (
              <option key={prateleira} value={prateleira}>Prateleira {prateleira}</option>
            ))}
          </select>
          <select className="px-4 py-2 border rounded-lg" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="title">Ordenar por titulo</option>
            <option value="author">Ordenar por autor</option>
            <option value="available">Ordenar por disponiveis</option>
            <option value="created">Ordenar por data</option>
          </select>
          <select className="px-4 py-2 border rounded-lg" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as any)}>
            <option value="asc">Ascendente</option>
            <option value="desc">Descendente</option>
          </select>
          <select className="px-4 py-2 border rounded-lg" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            {[10, 20, 30, 50].map(size => (
              <option key={size} value={size}>{size} por pagina</option>
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
        <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full text-left border-collapse">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-4 text-xs uppercase text-gray-400">Titulo</th>
              <th className="p-4 text-xs uppercase text-gray-400">Autor</th>
              <th className="p-4 text-xs uppercase text-gray-400">ISBN</th>
              <th className="p-4 text-xs uppercase text-gray-400">Tipo</th>
              <th className="p-4 text-xs uppercase text-gray-400 text-right">Disponivel</th>
              <th className="p-4 text-xs uppercase text-gray-400 text-right">Acoes</th>
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
                    {book.isDigital && (book.totalCopies ?? 0) > 0 ? 'Digital + Fisico' : (book.isDigital ? 'Digital' : 'Fisico')}
                  </td>
                  <td className="p-4 text-sm text-right font-mono">
                    {book.isDigital ? 'inf' : `${book.availableCopies} / ${book.totalCopies}`}
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
        <span>Pagina {page} de {totalPages}</span>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Anterior</Button>
          <Button variant="secondary" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Seguinte</Button>
        </div>
      </div>
    </div>
  );
};
