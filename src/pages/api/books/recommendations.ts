import type { NextApiRequest, NextApiResponse } from "next";
import { drizzle } from "drizzle-orm/neon-http";
import { desc, eq, inArray, sql } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { DEFAULT_BOOK_COVER } from "@/constants.ts";

type ErrorResponse = { error: string };

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
  prateleira: row.prateleira ?? null,
  anoEdicao: row.anoEdicao ?? null,
  edicao: row.edicao ?? null,
  isbn: row.isbn,
  fileUrl: row.fileUrl ?? null,
  documentType: row.document_type ?? 1,
  isDigital: row.is_digital ?? Boolean(row.fileUrl),
  createdAt: row.created_at ?? row.createdAt,
});

const getDb = () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL in environment variables.");
  }
  return drizzle(databaseUrl);
};

const unique = (list: number[]) => Array.from(new Set(list)).filter((v) => Number.isFinite(v));

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any[] | ErrorResponse>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Metodo nao permitido" });
  }

  const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const limit = Math.min(30, Math.max(1, Number(rawLimit || 6)));
  const userId =
    (Array.isArray(req.query.userId) ? req.query.userId[0] : req.query.userId) ||
    (req.headers["x-user-id"] as string | undefined);
  const clickedRaw = Array.isArray(req.query.clicked) ? req.query.clicked[0] : req.query.clicked;
  const clickedIds = clickedRaw
    ? clickedRaw
        .split(",")
        .map((v) => Number(v.trim()))
        .filter((v) => !Number.isNaN(v))
    : [];

  try {
    const db = getDb();

    const userBookIds: number[] = [];

    if (userId) {
      const transactions = await db
        .select({ physicalBookId: schema.transactions.physicalBookId })
        .from(schema.transactions)
        .where(eq(schema.transactions.userId, userId));

      const physicalIds = unique(transactions.map((t) => Number(t.physicalBookId)).filter(Boolean));
      if (physicalIds.length) {
        const physicals = await db
          .select()
          .from(schema.physicalBooks)
          .where(inArray(schema.physicalBooks.pid, physicalIds));
        userBookIds.push(...physicals.map((p) => p.bookId));
      }

      const digitalRows = await db
        .select({ bookId: schema.userDigitalBooks.bookId })
        .from(schema.userDigitalBooks)
        .where(eq(schema.userDigitalBooks.userId, userId));
      userBookIds.push(...digitalRows.map((d) => d.bookId));

      const clickRows = await db
        .select({ bookId: schema.bookClicks.bookId })
        .from(schema.bookClicks)
        .where(eq(schema.bookClicks.userId, userId))
        .limit(50);
      userBookIds.push(...clickRows.map((c) => c.bookId));
    }

    userBookIds.push(...clickedIds);
    const userBookSet = new Set<number>(unique(userBookIds));

    let recommended: any[] = [];

    if (userBookSet.size > 0) {
      const userBooks = await db
        .select()
        .from(schema.books)
        .where(inArray(schema.books.id, Array.from(userBookSet)));
      const genreCounts: Record<string, number> = {};
      userBooks.forEach((b) => {
        const key = b.genre || "Sem curso";
        genreCounts[key] = (genreCounts[key] || 0) + 1;
      });
      const topGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([genre]) => genre)
        .slice(0, 3);

      if (topGenres.length) {
        const genreCandidates = await db
          .select()
          .from(schema.books)
          .where(inArray(schema.books.genre, topGenres))
          .orderBy(desc(schema.books.availableCopies))
          .limit(limit * 3);
        recommended = genreCandidates.filter((b) => !userBookSet.has(b.id)).slice(0, limit);
      }
    }

    if (recommended.length < limit) {
      const popular = await db
        .select({
          bookId: schema.physicalBooks.bookId,
          total: sql<number>`count(*)`,
        })
        .from(schema.transactions)
        .leftJoin(
          schema.physicalBooks,
          eq(schema.transactions.physicalBookId, schema.physicalBooks.pid)
        )
        .groupBy(schema.physicalBooks.bookId)
        .orderBy(desc(sql<number>`count(*)`))
        .limit(limit * 2);

      const popularIds = popular.map((p) => p.bookId).filter(Boolean) as number[];
      if (popularIds.length) {
        const popularBooks = await db
          .select()
          .from(schema.books)
          .where(inArray(schema.books.id, popularIds));
        const countMap = new Map<number, number>(
          popular.map((p) => [Number(p.bookId), Number(p.total)])
        );
        const ordered = [...popularBooks].sort(
          (a, b) => (countMap.get(b.id) || 0) - (countMap.get(a.id) || 0)
        );
        const extra = ordered.filter((b) => !userBookSet.has(b.id));
        recommended = [...recommended, ...extra].slice(0, limit);
      }
    }

    if (recommended.length < limit) {
      const fallback = await db
        .select()
        .from(schema.books)
        .orderBy(desc(schema.books.availableCopies))
        .limit(limit * 2);
      const extra = fallback.filter((b) => !userBookSet.has(b.id));
      recommended = [...recommended, ...extra].slice(0, limit);
    }

    if (recommended.length === 0) {
      const anyBooks = await db.select().from(schema.books).orderBy(desc(schema.books.id)).limit(limit);
      recommended = anyBooks;
    }

    return res.status(200).json(recommended.map(mapBookRow));
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: error?.message || "Erro ao gerar recomendacoes" });
  }
}
