import type { NextApiRequest, NextApiResponse } from "next";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";

type ErrorResponse = { error: string };
type ProfileResponse = { fullName: string | null } | { success: true };

const getUserId = (req: NextApiRequest): string | null => {
  const header = req.headers["x-user-id"];
  if (Array.isArray(header)) return header[0] ?? null;
  return header ?? null;
};

const getDb = () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL in environment variables.");
  }
  return drizzle(databaseUrl);
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProfileResponse | ErrorResponse>
) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Nao autorizado" });

  const db = getDb();

  if (req.method === "GET") {
    const record = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.clerkId, userId))
      .limit(1);

    return res.status(200).json({ fullName: record[0]?.fullName ?? "" });
  }

  if (req.method === "POST") {
    const { fullName, email, role } = (req.body || {}) as {
      fullName?: string;
      email?: string;
      role?: string;
    };
    const name = String(fullName || "").trim();
    if (!name) return res.status(400).json({ error: "Nome completo obrigatorio" });

    await db
      .insert(schema.users)
      .values({
        clerkId: userId,
        primaryEmail: email || "",
        fullName: name,
        role: role || "external",
      })
      .onConflictDoUpdate({
        target: schema.users.clerkId,
        set: {
          fullName: name,
          primaryEmail: email || "",
          role: role || "external",
        },
      });

    return res.status(200).json({ success: true });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Metodo nao permitido" });
}
