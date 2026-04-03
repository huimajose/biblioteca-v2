import { NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
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

export async function GET() {
  try {
    const db = getDb();
    const books = await db.select().from(schema.books).orderBy(asc(schema.books.id));
    return NextResponse.json(books.map(mapBookRow));
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao carregar livros' },
      { status: 500 }
    );
  }
}
