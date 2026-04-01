import type { NextApiRequest, NextApiResponse } from "next";
import { drizzle } from "drizzle-orm/neon-http";
import { desc, eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";

type ErrorResponse = { error: string };
type StudentInfoResponse = {
  fullName: string | null;
  studentNumber: string | null;
  status: string | null;
  verifiedAt: string | null;
  role: string | null;
};

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
  res: NextApiResponse<StudentInfoResponse | ErrorResponse>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Metodo nao permitido" });
  }

  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Nao autorizado" });

  const db = getDb();
  const record = await db
    .select()
    .from(schema.studentVerifications)
    .where(eq(schema.studentVerifications.clerkId, userId))
    .orderBy(desc(schema.studentVerifications.createdAt))
    .limit(1);

  const recordAlt = await db
    .select()
    .from(schema.studentsVerifications)
    .where(eq(schema.studentsVerifications.clerkId, userId))
    .orderBy(desc(schema.studentsVerifications.createdAt))
    .limit(1);

  const user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.clerkId, userId))
    .limit(1);

  return res.status(200).json({
    fullName: record[0]?.fullName ?? recordAlt[0]?.fullName ?? null,
    studentNumber: record[0]?.studentNumber ?? recordAlt[0]?.studentNumber ?? null,
    status: record[0]?.status ?? recordAlt[0]?.status ?? null,
    verifiedAt: record[0]?.verifiedAt ?? recordAlt[0]?.verifiedAt ?? null,
    role: user[0]?.role ?? "external",
  });
}
