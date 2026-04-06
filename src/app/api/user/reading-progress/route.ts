import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";
import {
  FREE_READING_PREVIEW_PAGES,
  getReadingProgressForBook,
  upsertReadingProgress,
} from "@/app/api/_utils/readingProgress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const userId = req.headers.get("x-user-id") || "";
    const { searchParams } = new URL(req.url);
    const bookId = Number(searchParams.get("bookId"));

    if (!userId || !bookId) {
      return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
    }

    const db = getDb();
    const progress = await getReadingProgressForBook(db, userId, bookId);
    const shelf = await db
      .select()
      .from(schema.userDigitalBooks)
      .where(
        and(
          eq(schema.userDigitalBooks.userId, userId),
          eq(schema.userDigitalBooks.bookId, bookId)
        )
      )
      .limit(1);

    return NextResponse.json({
      progress,
      inShelf: Boolean(shelf[0]),
      previewLimit: FREE_READING_PREVIEW_PAGES,
    });
  } catch {
    return NextResponse.json(
      { error: "Erro ao carregar progresso de leitura" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const userId = req.headers.get("x-user-id") || "";
    const body = (await req.json().catch(() => ({}))) as {
      bookId?: number;
      currentPage?: number;
      totalPages?: number;
    };
    const bookId = Number(body.bookId);
    const currentPage = Number(body.currentPage);
    const totalPages = Number(body.totalPages ?? 0);

    if (
      !userId ||
      !Number.isFinite(bookId) ||
      bookId <= 0 ||
      !Number.isFinite(currentPage) ||
      currentPage <= 0 ||
      !Number.isFinite(totalPages) ||
      totalPages < 0
    ) {
      return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
    }

    const db = getDb();
    const progress = await upsertReadingProgress(db, {
      userId,
      bookId,
      currentPage,
      totalPages,
    });

    return NextResponse.json({ success: true, progress });
  } catch {
    return NextResponse.json(
      { error: "Erro ao guardar progresso de leitura" },
      { status: 500 }
    );
  }
}
