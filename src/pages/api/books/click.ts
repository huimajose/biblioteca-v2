import type { NextApiRequest, NextApiResponse } from "next";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/pgSchema";

type ErrorResponse = { error: string };

const getDb = () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL in environment variables.");
  }
  return drizzle(databaseUrl);
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ ok: boolean } | ErrorResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Metodo nao permitido" });
  }

  try {
    const body = req.body || {};
    const bookId = Number(body.bookId);
    const userId = String(body.userId || '');

    if (!bookId || Number.isNaN(bookId) || !userId) {
      return res.status(400).json({ error: "Dados invalidos" });
    }

    const db = getDb();
    await db.insert(schema.bookClicks).values({
      bookId,
      userId,
    });

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao registar clique" });
  }
}
