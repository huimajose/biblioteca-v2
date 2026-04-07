import type { NextApiRequest, NextApiResponse } from "next";
import { drizzle } from "drizzle-orm/neon-http";
import { and, asc, eq, sql } from "drizzle-orm";
import * as schema from "@/db/pgSchema";

type ErrorResponse = { error: string };

const getDb = () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL in environment variables.");
  }
  return drizzle(databaseUrl);
};

const normalizeCourseCode = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any[] | Record<string, unknown> | ErrorResponse>
) {
  try {
    const db = getDb();

    if (req.method === "GET") {
      const genres = await db
        .select()
        .from(schema.genres)
        .orderBy(asc(schema.genres.displayOrder), asc(schema.genres.name));
      return res.status(200).json(genres);
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const name = String(body.name || "").trim();
      if (!name) return res.status(400).json({ error: "Nome do curso obrigatorio" });

      const created = await db
        .insert(schema.genres)
        .values({
          name,
          code: normalizeCourseCode(body.code) || null,
          displayOrder: body.displayOrder ? Number(body.displayOrder) : null,
          defaultArmario: String(body.defaultArmario || "").trim() || null,
          shelfStart: body.shelfStart === null || body.shelfStart === "" || body.shelfStart === undefined ? null : Number(body.shelfStart),
          shelfEnd: body.shelfEnd === null || body.shelfEnd === "" || body.shelfEnd === undefined ? null : Number(body.shelfEnd),
        })
        .returning();

      return res.status(200).json(created[0]);
    }

    if (req.method === "PUT") {
      const id = Number((Array.isArray(req.query.id) ? req.query.id[0] : req.query.id) || req.body?.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: "Curso invalido" });

      const body = req.body || {};
      const name = String(body.name || "").trim();
      if (!name) return res.status(400).json({ error: "Nome do curso obrigatorio" });
      const existing = await db.select().from(schema.genres).where(eq(schema.genres.id, id)).limit(1);
      if (!existing[0]) return res.status(404).json({ error: "Curso nao encontrado" });

      const updated = await db
        .update(schema.genres)
        .set({
          name,
          code: normalizeCourseCode(body.code) || null,
          displayOrder: body.displayOrder ? Number(body.displayOrder) : null,
          defaultArmario: String(body.defaultArmario || "").trim() || null,
          shelfStart: body.shelfStart === null || body.shelfStart === "" || body.shelfStart === undefined ? null : Number(body.shelfStart),
          shelfEnd: body.shelfEnd === null || body.shelfEnd === "" || body.shelfEnd === undefined ? null : Number(body.shelfEnd),
        })
        .where(eq(schema.genres.id, id))
        .returning();

      await db
        .update(schema.books)
        .set({ genre: updated[0].name })
        .where(eq(schema.books.genre, existing[0].name));

      await db
        .update(schema.books)
        .set({ armario: String(updated[0].defaultArmario || "").trim() || null })
        .where(and(eq(schema.books.genre, updated[0].name), sql`(armario IS NULL OR trim(armario) = '')`));

      return res.status(200).json(updated[0]);
    }

    res.setHeader("Allow", "GET, POST, PUT");
    return res.status(405).json({ error: "Metodo nao permitido" });
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: error?.message || "Erro ao carregar cursos" });
  }
}
