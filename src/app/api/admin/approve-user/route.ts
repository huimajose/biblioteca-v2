import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    clerkId?: string;
    approve?: boolean;
  };
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

  return NextResponse.json({ success: true });
}
