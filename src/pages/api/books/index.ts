import type { NextApiRequest, NextApiResponse } from "next";
import { drizzle } from "drizzle-orm/neon-http";
import { asc } from "drizzle-orm";
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

const getDb = () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL in environment variables.");
  }
  return drizzle(databaseUrl);
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any[] | ErrorResponse>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Metodo nao permitido" });
  }

  const db = getDb();
  try {
    const books = await db.select().from(schema.books).orderBy(asc(schema.books.id));
    return res.status(200).json(books.map(mapBookRow));
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: error?.message || "Erro ao carregar livros" });
  }
}
