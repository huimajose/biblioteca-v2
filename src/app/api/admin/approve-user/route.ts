import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";
import { notifyUser } from "@/app/api/_utils/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    clerkId?: string;
    approve?: boolean;
  };
  const actorUserId = req.headers.get("x-user-id") || "";
  const clerkId = body?.clerkId;
  const approve = !!body?.approve;
  if (!clerkId) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 });
  }

  const db = getDb();
  const pending = await db
    .select()
    .from(schema.verifyPending)
    .where(eq(schema.verifyPending.clerkId, clerkId))
    .limit(1);

  if (!pending[0]) {
    return NextResponse.json({ error: "Pedido nao encontrado" }, { status: 404 });
  }

  if (approve) {
    await db.insert(schema.users).values({
      clerkId: pending[0].clerkId ?? clerkId,
      primaryEmail: pending[0].email,
      fullName: "",
      role: "external",
    });
  }

  await db
    .delete(schema.verifyPending)
    .where(eq(schema.verifyPending.clerkId, clerkId));

  await notifyUser(
    db,
    clerkId,
    approve ? "Acesso aprovado" : "Acesso rejeitado",
    approve
      ? "O seu pedido de acesso foi aprovado. Ja pode entrar na plataforma."
      : "O seu pedido de acesso foi rejeitado."
  );

  if (actorUserId) {
    await notifyUser(
      db,
      actorUserId,
      approve ? "Utilizador aprovado" : "Utilizador rejeitado",
      approve
        ? `O acesso do utilizador ${pending[0].email} foi aprovado.`
        : `O acesso do utilizador ${pending[0].email} foi rejeitado.`
    );
  }

  return NextResponse.json({ success: true });
}
