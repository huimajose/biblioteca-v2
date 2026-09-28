export interface CatalogBook {
  id: number;
  author: string;
  genre?: string;
  courseSequence?: number | null;
  catalogCode?: string | null;
  totalCopies?: number;
}

const letters = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');

export function authorAbbreviation(author: string): string {
  const firstAuthor = author.split(/;|\s+e\s+|\s+&\s+/i)[0].trim();
  const surname = firstAuthor.includes(',') ? firstAuthor.split(',')[0] : firstAuthor.split(/\s+/).pop() || '';
  return letters(surname).slice(0, 3) || 'SNA';
}

export function catalogParts(book: CatalogBook, courseCode?: string) {
  const legacy = book.catalogCode?.match(/^([A-Z]+)-(\d+)$/i);
  const current = book.catalogCode?.match(/^(\d+)-[A-Z]+-([A-Z]+)$/i);
  const sequence = book.courseSequence || Number(legacy?.[2] || current?.[1]) || book.id;
  return {
    number: String(sequence).padStart(3, '0'),
    author: authorAbbreviation(book.author),
    course: letters(courseCode || current?.[2] || legacy?.[1] || book.genre || '').slice(0, 6) || 'CUR',
  };
}

export function formatBookCatalog(book: CatalogBook, courseCode?: string) {
  const parts = catalogParts(book, courseCode);
  return `${parts.number}-${parts.author}-${parts.course}`;
}

export function bookLabelLines(book: CatalogBook, copy = 1, courseCode?: string) {
  const parts = catalogParts(book, courseCode);
  return ['ISPI - Biblioteca', parts.number, parts.author, parts.course, `Ex. ${copy}`];
}

export function physicalCopyNumbers(book: CatalogBook): number[] {
  const count = Number(book.totalCopies ?? 0);
  return Number.isSafeInteger(count) && count > 0 ? Array.from({ length: count }, (_, i) => i + 1) : [];
}
