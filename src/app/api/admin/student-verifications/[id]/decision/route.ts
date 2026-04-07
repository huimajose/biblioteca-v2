import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";
import { notifyUser } from "@/app/api/_utils/notify";
import { ensureStudentVerificationCourseColumn } from "@/app/api/_utils/studentVerification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function POST(req: Request, { params }: { params: Params }) {
  try {
    const resolved = await params;
    const id = Number(resolved?.id);
    const body = (await req.json().catch(() => ({}))) as { approve?: boolean };
    const approve = !!body?.approve;

    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Pedido invalido" }, { status: 400 });
    }

    const db = getDb();
    await ensureStudentVerificationCourseColumn(db);
    const entry = await db
      .select()
      .from(schema.studentVerifications)
      .where(eq(schema.studentVerifications.id, id))
      .limit(1);
    if (!entry[0]) {
      return NextResponse.json({ error: "Pedido nao encontrado" }, { status: 404 });
    }

    const newStatus = approve ? "approved" : "rejected";
    const now = new Date();

    await db
      .update(schema.studentVerifications)
      .set({ status: newStatus, verifiedAt: now })
      .where(eq(schema.studentVerifications.id, id));

    await db
      .update(schema.studentsVerifications)
      .set({ status: newStatus, verifiedAt: now })
      .where(eq(schema.studentsVerifications.clerkId, entry[0].clerkId));

    await db
      .update(schema.users)
      .set({ role: approve ? "student" : "external" })
      .where(eq(schema.users.clerkId, entry[0].clerkId));

    await notifyUser(
      db,
      entry[0].clerkId,
      approve ? "Verificacao aprovada" : "Verificacao rejeitada",
      approve
        ? `O seu pedido foi aprovado. A sua conta agora e considerada estudante${entry[0].course ? ` do curso ${entry[0].course}` : ""}.`
        : "O seu pedido foi rejeitado. A sua conta permanece como externo."
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao processar pedido" },
      { status: 500 }
    );
  }
}
