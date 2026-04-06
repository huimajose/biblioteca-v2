import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";
import { notifyUser } from "@/app/api/_utils/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      tid?: number;
      userId?: string;
    };
    const tid = Number(body.tid);
    const userId = body.userId || "";

    if (!tid || !userId) {
      return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
    }

    const adminId = req.headers.get("x-admin-id") || req.headers.get("x-user-id") || "system";
    const db = getDb();

    const tx = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.tid, tid))
      .limit(1);

    if (!tx[0]) {
      return NextResponse.json({ error: "Transacao nao encontrada" }, { status: 404 });
    }

    if (tx[0].status !== "PENDING") {
      return NextResponse.json(
        { error: "Transacao nao esta pendente" },
        { status: 400 }
      );
    }

    await db
      .update(schema.transactions)
      .set({
        status: "REJECTED",
        adminId,
        returnedDate: new Date(),
      })
      .where(eq(schema.transactions.tid, tid));

    await notifyUser(
      db,
      userId,
      "Pedido rejeitado",
      "O seu pedido de emprestimo foi rejeitado."
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
