import type { NextApiRequest, NextApiResponse } from "next";
import { drizzle } from "drizzle-orm/neon-http";
import { asc } from "drizzle-orm";
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
  res: NextApiResponse<any[] | ErrorResponse>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Metodo nao permitido" });
  }

  try {
    const db = getDb();
    const genres = await db.select().from(schema.genres).orderBy(asc(schema.genres.name));
    return res.status(200).json(genres);
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: error?.message || "Erro ao carregar cursos" });
  }
}
