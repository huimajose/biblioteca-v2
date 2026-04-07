import type { NextApiRequest, NextApiResponse } from "next";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { appendAuditLog, resolveActorRole } from "@/app/api/_utils/audit";
import { canAccessAdminSection } from "@/utils/roles";

type ErrorResponse = { error: string };

const getDb = () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL in environment variables.");
  }
  return drizzle(databaseUrl);
};

const renumberBooksForGenre = async (db: ReturnType<typeof getDb>, genreName?: string | null) => {
  if (genreName && String(genreName).trim()) {
    await db.execute(sql`
      WITH ranked AS (
        SELECT
          b.id,
          ROW_NUMBER() OVER (
            PARTITION BY b.genre
            ORDER BY
              CASE WHEN b.prateleira IS NULL THEN 1 ELSE 0 END,
              b.prateleira ASC,
              b.title ASC,
              b.id ASC
          )::int AS next_sequence,
          CONCAT(
            COALESCE(NULLIF(TRIM(g.code), ''), 'CUR'),
            '-',
            LPAD(
              ROW_NUMBER() OVER (
                PARTITION BY b.genre
                ORDER BY
                  CASE WHEN b.prateleira IS NULL THEN 1 ELSE 0 END,
                  b.prateleira ASC,
                  b.title ASC,
                  b.id ASC
              )::text,
              3,
              '0'
            )
          ) AS next_catalog_code
        FROM books b
        LEFT JOIN genres g ON g.name = b.genre
        WHERE b.genre = ${genreName}
      )
      UPDATE books AS b
      SET
        course_sequence = ranked.next_sequence,
        catalog_code = ranked.next_catalog_code
      FROM ranked
      WHERE ranked.id = b.id
    `);
    return;
  }

  await db.execute(sql`
    WITH ranked AS (
      SELECT
        b.id,
        ROW_NUMBER() OVER (
          PARTITION BY b.genre
          ORDER BY
            CASE WHEN b.prateleira IS NULL THEN 1 ELSE 0 END,
            b.prateleira ASC,
            b.title ASC,
            b.id ASC
        )::int AS next_sequence,
        CONCAT(
          COALESCE(NULLIF(TRIM(g.code), ''), 'CUR'),
          '-',
          LPAD(
            ROW_NUMBER() OVER (
              PARTITION BY b.genre
              ORDER BY
                CASE WHEN b.prateleira IS NULL THEN 1 ELSE 0 END,
                b.prateleira ASC,
                b.title ASC,
                b.id ASC
            )::text,
            3,
            '0'
          )
        ) AS next_catalog_code
      FROM books b
      LEFT JOIN genres g ON g.name = b.genre
    )
    UPDATE books AS b
    SET
      course_sequence = ranked.next_sequence,
      catalog_code = ranked.next_catalog_code
    FROM ranked
    WHERE ranked.id = b.id
  `);
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean; scope: string } | ErrorResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Metodo nao permitido" });
  }

  try {
    const db = getDb();
    const actorUserId = String(req.headers["x-user-id"] || "");
    const actorRole = await resolveActorRole(db, actorUserId);
    if (!canAccessAdminSection(actorRole, "courses")) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    const genreName = String(req.body?.genreName || "").trim();
    await renumberBooksForGenre(db, genreName || undefined);
    await appendAuditLog(db, {
      actorUserId,
      action: "renumber-course",
      entityType: "course",
      entityId: genreName || "all",
      details: genreName ? `Curso "${genreName}" renumerado.` : "Todos os cursos foram renumerados.",
      metadata: { scope: genreName || "all" },
    });
    return res.status(200).json({ success: true, scope: genreName || "all" });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao renumerar curso" });
  }
}
