import type { NextApiRequest, NextApiResponse } from "next";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import * as schema from "@/db/pgSchema";

type CountResponse = { count: number };
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
  res: NextApiResponse<CountResponse | ErrorResponse>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Metodo nao permitido" });
  }

  const db = getDb();
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.users);
  return res.status(200).json({ count: result[0]?.count ?? 0 });
}
