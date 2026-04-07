import { NextResponse } from "next/server";
import { desc, eq, gte, inArray, sql } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";
import { DEFAULT_BOOK_COVER } from "@/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mapBookRow = (row: any) => ({
  id: row.id,
  title: row.title,
  author: row.author,
  genre: row.genre ?? "",
  totalCopies: row.totalCopies ?? 0,
  availableCopies: row.availableCopies ?? 0,
  cover: row.cover || DEFAULT_BOOK_COVER,
  editora: row.editora ?? "",
  cdu: row.cdu ?? "",
  armario: row.armario ?? "",
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

export async function GET(req: Request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const rawDays = searchParams.get("days");
    const days = rawDays ? Number(rawDays) : null;
    const hasRange = Number.isFinite(days) && (days as number) > 0;
    const rangeStart = hasRange
      ? sql`now() - ${days} * interval '1 day'`
      : null;

    const baseQuery = db
      .select({
        bookId: schema.bookClicks.bookId,
        total: sql<number>`count(*)`,
      })
      .from(schema.bookClicks)
      .groupBy(schema.bookClicks.bookId)
      .orderBy(desc(sql<number>`count(*)`))
      .limit(10);

    const raw = rangeStart
      ? await baseQuery.where(gte(schema.bookClicks.createdAt, rangeStart))
      : await baseQuery;

    const ids = raw.map((r) => r.bookId).filter(Boolean) as number[];
    if (!ids.length) return NextResponse.json([]);

    const books = await db
      .select()
      .from(schema.books)
      .where(inArray(schema.books.id, ids));

    const countMap = new Map<number, number>(raw.map((r) => [Number(r.bookId), Number(r.total)]));
    const ordered = [...books].sort((a, b) => (countMap.get(b.id) || 0) - (countMap.get(a.id) || 0));

    return NextResponse.json(
      ordered.map((b) => ({
        ...mapBookRow(b),
        totalClicks: countMap.get(b.id) || 0,
      }))
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao carregar ranking" },
      { status: 500 }
    );
  }
}
