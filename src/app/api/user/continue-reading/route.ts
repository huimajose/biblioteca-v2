import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";
import { ensureReadingProgressTable } from "@/app/api/_utils/readingProgress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mapBookRow = (row: any) => ({
  id: row.id,
  title: row.title,
  author: row.author,
  genre: row.genre ?? "",
  totalCopies: row.totalCopies ?? 0,
  availableCopies: row.availableCopies ?? 0,
  cover: row.cover || "/cover_2.jpeg",
  editora: row.editora ?? "",
  cdu: row.cdu ?? "",
  prateleira: row.prateleira ?? null,
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
    const userId = req.headers.get("x-user-id") || "";
    if (!userId) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    const db = getDb();
    await ensureReadingProgressTable(db);

    const progressRows = await db
      .select()
      .from(schema.userReadingProgress)
      .where(eq(schema.userReadingProgress.userId, userId))
      .orderBy(desc(schema.userReadingProgress.lastReadAt));

    const filtered = progressRows.filter(
      (row) => !row.isCompleted && Math.max(row.currentPage ?? 0, row.maxPageRead ?? 0) > 0
    );

    const items = await Promise.all(
      filtered.map(async (row) => {
        const book = await db
          .select()
          .from(schema.books)
          .where(eq(schema.books.id, row.bookId))
          .limit(1);

        const shelf = await db
          .select()
          .from(schema.userDigitalBooks)
          .where(
            and(
              eq(schema.userDigitalBooks.userId, userId),
              eq(schema.userDigitalBooks.bookId, row.bookId)
            )
          )
          .limit(1);

        const bookRow = book[0];
        if (!bookRow) return null;
        const isDigital = bookRow.is_digital ?? Boolean(bookRow.fileUrl);
        if (!isDigital) return null;

        return {
          id: row.id,
          userId: row.userId,
          bookId: row.bookId,
          currentPage: row.currentPage,
          maxPageRead: row.maxPageRead,
          totalPages: row.totalPages,
          progressPercent: row.progressPercent,
          isCompleted: row.isCompleted,
          lastReadAt: row.lastReadAt,
          inShelf: Boolean(shelf[0]),
          book: mapBookRow(bookRow),
        };
      })
    );

    return NextResponse.json(items.filter(Boolean));
  } catch {
    return NextResponse.json(
      { error: "Erro ao carregar livros em leitura" },
      { status: 500 }
    );
  }
}
