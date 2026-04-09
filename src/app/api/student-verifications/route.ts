import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";
import { notifyAdmins, notifyUser } from "@/app/api/_utils/notify";
import { ensureStudentVerificationCourseColumn } from "@/app/api/_utils/studentVerification";

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
    course?: string;
  };
  const studentNumber = String(body?.studentNumber || "").trim();
  const fullName = String(body?.fullName || "").trim();
  const course = String(body?.course || "").trim();
  if (!studentNumber || !fullName || !course) {
    return NextResponse.json({ error: "Dados em falta" }, { status: 400 });
  }

  const db = getDb();
  await ensureStudentVerificationCourseColumn(db);
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
    course,
    status: "pending",
    createdAt: now,
  });

  await notifyUser(
    db,
    userId,
    "Verificacao enviada",
    "O seu pedido de verificacao de estudante foi enviado com sucesso."
  );
  await notifyAdmins(
    db,
    "Nova verificacao de estudante",
    `Pedido de verificacao: ${fullName} (${studentNumber}) - Curso: ${course}`
  );

  return NextResponse.json({ success: true });
}
