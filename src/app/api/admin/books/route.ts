import { NextRequest, NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import * as schema from '@/db/pgSchema';
import { getDb } from '@/app/api/_utils/db';
import { DEFAULT_BOOK_COVER } from '@/constants';
import { notifyUser } from '@/app/api/_utils/notify';
import { appendAuditLog, resolveActorRole } from '@/app/api/_utils/audit';
import { canAccessAdminSection } from '@/utils/roles';

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
  armario: row.armario ?? '',
  prateleira: row.prateleira ?? null,
  courseSequence: row.courseSequence ?? row.course_sequence ?? null,
  catalogCode: row.catalogCode ?? row.catalog_code ?? null,
  anoEdicao: row.anoEdicao ?? null,
  edicao: row.edicao ?? null,
  isbn: row.isbn,
  fileUrl: row.fileUrl ?? null,
  documentType: row.document_type ?? 1,
  isDigital: row.is_digital ?? Boolean(row.fileUrl),
  createdAt: row.created_at ?? row.createdAt,
});

const normalizeNullableText = (value: unknown) => {
  const text = String(value ?? '').trim();
  return text ? text : null;
};

const normalizeIsbn = (value: unknown) => String(value ?? '').trim();

const resolveDbErrorMessage = (error: any, fallback: string) => {
  const raw =
    error?.cause?.message ||
    error?.message ||
    fallback;
  const normalized = String(raw || fallback);

  if (/duplicate key value/i.test(normalized) || /unique constraint/i.test(normalized)) {
    if (/isbn/i.test(normalized)) {
      return 'Ja existe um livro com este ISBN.';
    }
    return 'Ja existe um registo com estes dados.';
  }

  return normalized;
};

const summarizeBookPayload = (body: any) => ({
  title: String(body?.title ?? '').trim(),
  author: String(body?.author ?? '').trim(),
  genre: String(body?.genre ?? '').trim(),
  isbn: normalizeIsbn(body?.isbn),
  documentType: Number(body?.documentType ?? 1),
  totalCopies: Number(body?.totalCopies ?? 0),
  hasDigital: Boolean(body?.hasDigital),
  hasFileUrl: Boolean(normalizeNullableText(body?.fileUrl)),
  hasCover: Boolean(normalizeNullableText(body?.cover)),
  armario: normalizeNullableText(body?.armario),
  prateleira: body?.prateleira ?? null,
  anoEdicao: body?.anoEdicao ?? null,
  edicao: body?.edicao ?? null,
});

const logBookRouteError = (stage: string, error: any, extra: Record<string, unknown> = {}) => {
  console.error('[admin/books][POST] failure', {
    stage,
    ...extra,
    message: error?.message ?? null,
    cause: error?.cause?.message ?? error?.cause ?? null,
    detail: error?.detail ?? null,
    hint: error?.hint ?? null,
    code: error?.code ?? null,
    stack: error?.stack ?? null,
  });
};

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

const formatCatalogCode = (code: string, sequence: number) =>
  `${code}-${String(sequence).padStart(3, '0')}`;

const resolveBookCatalogData = async (db: ReturnType<typeof getDb>, input: {
  genre: string;
  armario?: string | null;
  currentBookId?: number;
  preserveSequence?: number | null;
  preserveCatalogCode?: string | null;
}) => {
  const genreName = String(input.genre || '').trim();
  const genreRow = genreName
    ? (
      await db
        .select()
        .from(schema.genres)
        .where(eq(schema.genres.name, genreName))
        .limit(1)
    )[0]
    : null;

  const courseCode = String(genreRow?.code || 'CUR').trim().toUpperCase();
  const armario = String(input.armario ?? genreRow?.defaultArmario ?? '').trim();

  if (input.preserveSequence && input.preserveCatalogCode) {
    return {
      armario,
      courseSequence: input.preserveSequence,
      catalogCode: input.preserveCatalogCode,
    };
  }

  const sameGenreBooks = await db
    .select({
      id: schema.books.id,
      courseSequence: schema.books.courseSequence,
    })
    .from(schema.books)
    .where(eq(schema.books.genre, genreName));

  const filtered = sameGenreBooks.filter((book) => book.id !== input.currentBookId);
  const nextSequence =
    filtered.reduce((max, book) => Math.max(max, Number(book.courseSequence ?? 0)), 0) + 1;

  return {
    armario,
    courseSequence: nextSequence,
    catalogCode: formatCatalogCode(courseCode, nextSequence),
  };
};

export async function POST(req: NextRequest) {
  let body: any = null;
  try {
    body = await req.json();
    const actorUserId = req.headers.get('x-user-id') || '';
    const db = getDb();
    console.info('[admin/books][POST] request received', {
      actorUserId: actorUserId || null,
      payload: summarizeBookPayload(body),
    });
    const actorRole = await resolveActorRole(db, actorUserId);
    if (!canAccessAdminSection(actorRole, 'books')) {
      console.warn('[admin/books][POST] access denied', { actorUserId: actorUserId || null, actorRole });
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }
    console.info('[admin/books][POST] actor resolved', { actorUserId: actorUserId || null, actorRole });
    const isbn = normalizeIsbn(body.isbn);
    if (!isbn) {
      console.warn('[admin/books][POST] missing isbn', { actorUserId: actorUserId || null });
      return NextResponse.json({ error: 'ISBN obrigatorio' }, { status: 400 });
    }

    const existingByIsbn = await db
      .select({ id: schema.books.id })
      .from(schema.books)
      .where(eq(schema.books.isbn, isbn))
      .limit(1);
    if (existingByIsbn[0]) {
      console.warn('[admin/books][POST] duplicate isbn blocked', {
        actorUserId: actorUserId || null,
        isbn,
        existingBookId: existingByIsbn[0].id,
      });
      return NextResponse.json({ error: 'Ja existe um livro com este ISBN.' }, { status: 409 });
    }

    const hasDigital =
      Boolean(body.fileUrl) || body.hasDigital === true || body.isDigital === true || body.documentType === 2;
    const isPhysical = (body.documentType ?? 1) !== 2;
    const totalCopies = isPhysical ? Number(body.totalCopies ?? 1) : 0;
    const availableCopies = isPhysical ? totalCopies : 0;
    const catalogData = await resolveBookCatalogData(db, {
      genre: body.genre ?? '',
      armario: body.armario ?? null,
    });
    console.info('[admin/books][POST] catalog data resolved', {
      actorUserId: actorUserId || null,
      isbn,
      catalogData,
    });

    const inserted = await db
      .insert(schema.books)
      .values({
        title: body.title,
        author: body.author,
        genre: body.genre ?? '',
        totalCopies,
        availableCopies,
        cover: body.cover || DEFAULT_BOOK_COVER,
        editora: normalizeNullableText(body.editora),
        cdu: normalizeNullableText(body.cdu),
        armario: catalogData.armario || null,
        prateleira: body.prateleira ?? null,
        courseSequence: catalogData.courseSequence,
        catalogCode: catalogData.catalogCode,
        anoEdicao: body.anoEdicao ?? null,
        edicao: body.edicao ?? null,
        isbn,
        fileUrl: normalizeNullableText(body.fileUrl),
        document_type: body.documentType ?? 1,
        is_digital: hasDigital,
      })
      .returning();
    console.info('[admin/books][POST] book inserted', {
      actorUserId: actorUserId || null,
      isbn,
      insertedCount: inserted.length,
      createdBookId: inserted[0]?.id ?? null,
    });

    const created = inserted[0];
    if (isPhysical && availableCopies > 0) {
      await createPhysicalCopies(db, created.id, availableCopies);
      console.info('[admin/books][POST] physical copies created', {
        actorUserId: actorUserId || null,
        bookId: created.id,
        copies: availableCopies,
      });
    }
    if (actorUserId) {
      try {
        await notifyUser(
          db,
          actorUserId,
          'Livro criado',
          `O livro "${created.title}" foi adicionado com sucesso.`
        );
        await appendAuditLog(db, {
          actorUserId,
          action: 'create-book',
          entityType: 'book',
          entityId: created.id,
          details: `Livro "${created.title}" criado no curso ${created.genre || 'Sem curso'}.`,
          metadata: {
            catalogCode: created.catalogCode ?? created.catalog_code ?? null,
            isDigital: created.is_digital ?? false,
          },
        });
      } catch (sideEffectError) {
        logBookRouteError('post-create-side-effects', sideEffectError, {
          actorUserId,
          bookId: created.id,
          isbn,
        });
      }
    }
    return NextResponse.json(mapBookRow(created));
  } catch (error: any) {
    logBookRouteError('request-handler', error, {
      payload: summarizeBookPayload(body),
    });
    return NextResponse.json(
      { error: resolveDbErrorMessage(error, 'Erro ao criar livro') },
      { status: 500 }
    );
  }
}
