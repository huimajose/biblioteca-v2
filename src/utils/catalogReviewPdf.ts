import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LOGO_WATERMARK } from '@/constants.ts';
import { addCenteredWatermarkToAllPages, loadWatermarkImage } from '@/utils/pdfWatermark.ts';

type CatalogReviewPdfOptions = {
  books: any[];
  filterLabel: string;
  search: string;
  issueLabels: Record<string, string>;
};

const text = (value: unknown, fallback = 'N/D') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

export const exportCatalogReviewPdf = async ({
  books,
  filterLabel,
  search,
  issueLabels,
}: CatalogReviewPdfOptions) => {
  const doc = new jsPDF('landscape', 'pt', 'a4');
  const generatedAt = new Date();

  doc.setFontSize(16);
  doc.text('Relatório de revisão do acervo', 40, 40);
  doc.setFontSize(10);
  doc.text(`Filtro: ${filterLabel}`, 40, 58);
  doc.text(`Pesquisa: ${search.trim() || 'Nenhum'}`, 40, 72);
  doc.text(`Total listado: ${books.length}`, 40, 86);
  doc.text(`Gerado em: ${generatedAt.toLocaleDateString()} ${generatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, 40, 100);

  const rows = books.map((book, index) => [
    String(index + 1),
    text(book.title),
    text(book.author),
    text(book.genre, 'Sem curso'),
    text(book.isbn, 'Sem ISBN'),
    text(book.catalogCode, 'Sem catalogo'),
    text(book.armario, '-'),
    text(book.prateleira, '-'),
    (book.reviewIssues || []).map((issue: string) => issueLabels[issue] || issue).join(', ') || 'N/D',
  ]);

  autoTable(doc, {
    startY: 118,
    head: [['#', 'Titulo', 'Autor', 'Curso', 'ISBN', 'Catalogo', 'Armário', 'Prateleira', 'Problemas']],
    body: rows.length ? rows : [['-', 'Nenhum livro encontrado', '-', '-', '-', '-', '-', '-', '-']],
    styles: { fontSize: 7, cellPadding: 4, overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: [101, 163, 13], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 24, halign: 'center' },
      1: { cellWidth: 120 },
      2: { cellWidth: 90 },
      3: { cellWidth: 72 },
      4: { cellWidth: 72 },
      5: { cellWidth: 70 },
      6: { cellWidth: 45 },
      7: { cellWidth: 48 },
      8: { cellWidth: 130 },
    },
    margin: { left: 40, right: 40, bottom: 34 },
  });

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Revisão do acervo | ${filterLabel}`, 40, pageHeight - 18);
    doc.text(`Página ${page} de ${totalPages}`, pageWidth - 40, pageHeight - 18, { align: 'right' });
    doc.setTextColor(0);
  }

  try {
    const logo = await loadWatermarkImage(LOGO_WATERMARK);
    addCenteredWatermarkToAllPages(doc, logo, { width: 160 });
  } catch {
    // Mantem o relatorio funcional mesmo se a marca d'agua nao carregar.
  }

  const suffix = filterLabel
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'todos';

  doc.save(`relatório-revisão-acervo-${suffix}.pdf`);
};
