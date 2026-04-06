import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import * as schema from '@/db/pgSchema';
import { getDb } from '@/app/api/_utils/db';
import { DEFAULT_BOOK_COVER } from '@/constants';
import { notifyUser } from '@/app/api/_utils/notify';

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

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const bookId = Number(id);
  if (Number.isNaN(bookId)) {
    return NextResponse.json({ error: 'Livro invalido' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const actorUserId = req.headers.get('x-user-id') || '';
    const db = getDb();

    const existing = await db
      .select()
      .from(schema.books)
      .where(eq(schema.books.id, bookId))
      .limit(1);
    if (!existing[0]) {
      return NextResponse.json({ error: 'Livro nao encontrado' }, { status: 404 });
    }

    const addCopies = Number(body.addCopies ?? 0);
    const nextDocumentType = body.documentType ?? existing[0].document_type ?? 1;
    const isPhysical = nextDocumentType !== 2;
    const hasDigital =
      Boolean(body.fileUrl ?? existing[0].fileUrl) ||
      body.hasDigital === true ||
      body.isDigital === true ||
      nextDocumentType === 2;

    const baseTotal = Number(body.totalCopies ?? existing[0].totalCopies ?? 0);
    const totalCopies = isPhysical ? baseTotal + Math.max(addCopies, 0) : 0;
    const availableCopies = isPhysical
      ? (existing[0].availableCopies ?? 0) + Math.max(addCopies, 0)
      : 0;

    const updated = await db
      .update(schema.books)
      .set({
        title: body.title ?? existing[0].title,
        author: body.author ?? existing[0].author,
        genre: body.genre ?? existing[0].genre,
        totalCopies,
        availableCopies,
        cover: body.cover ?? existing[0].cover ?? DEFAULT_BOOK_COVER,
        editora: body.editora ?? existing[0].editora ?? null,
        cdu: body.cdu ?? existing[0].cdu ?? null,
        prateleira: body.prateleira ?? existing[0].prateleira ?? null,
        anoEdicao: body.anoEdicao ?? existing[0].anoEdicao ?? null,
        edicao: body.edicao ?? existing[0].edicao ?? null,
        isbn: body.isbn ?? existing[0].isbn,
        fileUrl: body.fileUrl ?? existing[0].fileUrl,
        document_type: nextDocumentType,
        is_digital: hasDigital,
      })
      .where(eq(schema.books.id, bookId))
      .returning();

    if (isPhysical && addCopies > 0) {
      await createPhysicalCopies(db, bookId, addCopies);
    }
    if (!isPhysical) {
      await db.delete(schema.physicalBooks).where(eq(schema.physicalBooks.bookId, bookId));
    }
    if (actorUserId) {
      await notifyUser(
        db,
        actorUserId,
        'Livro atualizado',
        `As alteracoes do livro "${updated[0].title}" foram guardadas com sucesso.`
      );
    }

    return NextResponse.json(mapBookRow(updated[0]));
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao atualizar livro' },
      { status: 500 }
    );
  }
}
