import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import * as schema from '@/db/pgSchema';
import { getDb } from '@/app/api/_utils/db';
import { DEFAULT_BOOK_COVER } from '@/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const mapBookRow = (row: any) => ({
  id: row.id,
  title: row.title,
  author: row.author,
  genre: row.genre ?? '',
  totalCopies: row.totalCopies ?? 0,
  availableCopies: row.availableCopies ?? 0,
  cover: row.cover || DEFAULT_BOOK_COVER,
  editora: row.editora ?? '',
  cdu: row.cdu ?? '',
  prateleira: row.prateleira ?? null,
  anoEdicao: row.anoEdicao ?? null,
  edicao: row.edicao ?? null,
  isbn: row.isbn,
  fileUrl: row.fileUrl ?? null,
  documentType: row.document_type ?? 1,
  isDigital: row.is_digital ?? Boolean(row.fileUrl),
  createdAt: row.created_at ?? row.createdAt,
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const bookId = Number(params?.id);
  if (Number.isNaN(bookId)) {
    return NextResponse.json({ error: 'Livro invalido' }, { status: 400 });
  }
  try {
    const db = getDb();
    const book = await db
      .select()
      .from(schema.books)
      .where(eq(schema.books.id, bookId))
      .limit(1);
    if (!book[0]) {
      return NextResponse.json({ error: 'Livro nao encontrado' }, { status: 404 });
    }
    return NextResponse.json(mapBookRow(book[0]));
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao carregar livro' },
      { status: 500 }
    );
  }
}
