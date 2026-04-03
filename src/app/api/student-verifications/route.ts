import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getHeaderUserId = (req: NextRequest) => req.headers.get("x-user-id");

export async function POST(req: NextRequest) {
  const userId = getHeaderUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    studentNumber?: string;
    fullName?: string;
  };
  const studentNumber = String(body?.studentNumber || "").trim();
  const fullName = String(body?.fullName || "").trim();
  if (!studentNumber || !fullName) {
    return NextResponse.json({ error: "Dados em falta" }, { status: 400 });
  }

  const db = getDb();
  const existing = await db
    .select()
    .from(schema.studentVerifications)
    .where(eq(schema.studentVerifications.clerkId, userId))
    .limit(1);

  if (existing[0]) {
    return NextResponse.json(
      { error: "Pedido ja enviado" },
      { status: 409 }
    );
  }

  const now = new Date();
  await db.insert(schema.studentVerifications).values({
    clerkId: userId,
    fullName,
    studentNumber,
    status: "pending",
    createdAt: now,
  });
  await db.insert(schema.studentsVerifications).values({
    clerkId: userId,
    fullName,
    studentNumber,
    status: "pending",
    createdAt: now,
  });

  return NextResponse.json({ success: true });
}
