import type { NextApiRequest, NextApiResponse } from "next";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";

type ErrorResponse = { error: string };
type SuccessResponse = { success: true };

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
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Metodo nao permitido" });
  }

  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Nao autorizado" });

  const { studentNumber, fullName } = (req.body || {}) as {
    studentNumber?: string;
    fullName?: string;
  };
  if (!studentNumber || !fullName) {
    return res.status(400).json({ error: "Dados em falta" });
  }

  const db = getDb();
  try {
    await db.insert(schema.studentVerifications).values({
      clerkId: userId,
      fullName,
      studentNumber,
      status: "pending",
      createdAt: new Date(),
    });
    await db.insert(schema.studentsVerifications).values({
      clerkId: userId,
      fullName,
      studentNumber,
      status: "pending",
      createdAt: new Date(),
    });
    return res.status(200).json({ success: true });
  } catch (error: any) {
    const message = error?.message || "Erro ao enviar pedido";
    return res.status(500).json({ error: message });
  }
}
