import { NextRequest, NextResponse } from 'next/server';
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

const createPhysicalCopies = async (db: ReturnType<typeof getDb>, bookId: number, copies: number) => {
  if (copies <= 0) return;
  const rows = Array.from({ length: copies }).map(() => ({
    bookId,
    borrowed: false,
    returnDate: null,
    userId: null,
    currTransactionId: 0,
  }));
  await db.insert(schema.physicalBooks).values(rows);
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = getDb();
    const hasDigital =
      Boolean(body.fileUrl) || body.hasDigital === true || body.isDigital === true || body.documentType === 2;
    const isPhysical = (body.documentType ?? 1) !== 2;
    const totalCopies = isPhysical ? Number(body.totalCopies ?? 1) : 0;
    const availableCopies = isPhysical ? totalCopies : 0;

    const inserted = await db
      .insert(schema.books)
      .values({
        title: body.title,
        author: body.author,
        genre: body.genre ?? '',
        totalCopies,
        availableCopies,
        cover: body.cover || DEFAULT_BOOK_COVER,
        editora: body.editora ?? null,
        cdu: body.cdu ?? null,
        prateleira: body.prateleira ?? null,
        anoEdicao: body.anoEdicao ?? null,
        edicao: body.edicao ?? null,
        isbn: body.isbn,
        fileUrl: body.fileUrl ?? null,
        document_type: body.documentType ?? 1,
        is_digital: hasDigital,
      })
      .returning();

    const created = inserted[0];
    if (isPhysical && availableCopies > 0) {
      await createPhysicalCopies(db, created.id, availableCopies);
    }
    return NextResponse.json(mapBookRow(created));
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao criar livro' },
      { status: 500 }
    );
  }
}
