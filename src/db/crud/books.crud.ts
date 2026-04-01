import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function readBooks(
  page = 1,
  pageSize = 10,
  sort: string = 'title',
  order: string = 'asc',
  search: string = '',
  category?: string | null
) {
  const all = db.select().from(schema.books).all();
  const query = (search || '').toLowerCase();

  let filtered = all.filter((b: any) => {
    const matchesSearch =
      !query ||
      b.title?.toLowerCase().includes(query) ||
      b.author?.toLowerCase().includes(query) ||
      b.isbn?.toLowerCase().includes(query);
    const matchesCategory = !category || category === 'all' || b.genre === category;
    return matchesSearch && matchesCategory;
  });

  const dir = order === 'desc' ? -1 : 1;
  filtered = [...filtered].sort((a: any, b: any) => {
    if (sort === 'available') {
      return ((a.availableCopies ?? 0) - (b.availableCopies ?? 0)) * dir;
    }
    if (sort === 'created') {
      return (new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()) * dir;
    }
    const av = (a[sort] || '').toString().toLowerCase();
    const bv = (b[sort] || '').toString().toLowerCase();
    return av.localeCompare(bv) * dir;
  });

  const total = filtered.length;
  const start = Math.max(0, (page - 1) * pageSize);
  const data = filtered.slice(start, start + pageSize);

  return { data, total, page, pageSize };
}

export async function getRecentBooks(limit = 8) {
  const all = db.select().from(schema.books).all();
  return [...all].sort((a: any, b: any) => {
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  }).slice(0, limit);
}

export async function updateBookFileUrl(bookId: number, fileUrl: string) {
  db.update(schema.books)
    .set({ fileUrl })
    .where(eq(schema.books.id, bookId))
    .run();
}

export async function updateBook(
  bookId: number,
  title: string,
  author: string,
  genre: string,
  isbn: string,
  totalCopies: number,
  availableCopies: number,
  cover: string,
  fileUrl?: string | null,
  documentType?: number,
  isDigital?: boolean,
  prateleira?: number | null,
  editora?: string | null,
  cdu?: string | null,
  anoEdicao?: number | null,
  edicao?: number | null
) {
  db.update(schema.books)
    .set({
      title,
      author,
      genre,
      isbn,
      totalCopies,
      availableCopies,
      cover,
      prateleira: prateleira ?? null,
      editora: editora ?? null,
      cdu: cdu ?? null,
      anoEdicao: anoEdicao ?? null,
      edicao: edicao ?? null,
      fileUrl: fileUrl || null,
      documentType: documentType ?? 1,
      isDigital: Boolean(isDigital),
    })
    .where(eq(schema.books.id, bookId))
    .run();
}

export async function getBooksCount() {
  const all = db.select({ id: schema.books.id }).from(schema.books).all();
  return all.length;
}

export async function readPhysicalBooks(bookId: number) {
  return db.select().from(schema.physicalBooks).where(eq(schema.physicalBooks.bookId, bookId)).all();
}

export async function addBookToShelf(bookId: number, userId: string) {
  try {
    db.insert(schema.userDigitalBooks)
      .values({ userId, bookId })
      .run();
    return { success: true, message: 'Livro adicionado a estante.' };
  } catch (err) {
    return { success: false, message: 'Livro ja existe na estante.' };
  }
}

export async function rentBook(bookId: number, userId: string, _userName?: string) {
  // Backward compatibility: immediate borrow for a single copy
  const { createImmediateBorrow } = await import('@/db/crud/transactions.crud');
  const result = await createImmediateBorrow(bookId, userId, 'admin');
  if (!result.success) return { success: false, message: result.error };
  return { success: true, message: 'Emprestimo concluido com sucesso.', tid: result.tid };
}
