import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";
import { normalizeUserRole } from "@/utils/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getHeaderUserId = (req: NextRequest) => req.headers.get("x-user-id");

export async function GET(req: NextRequest) {
  const userId = getHeaderUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const db = getDb();
  const record = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.clerkId, userId))
    .limit(1);

  const user = record[0];
  return NextResponse.json({
    fullName: user?.fullName ?? "",
    email: user?.primaryEmail ?? "",
    role: normalizeUserRole(user?.role),
  });
}

export async function POST(req: NextRequest) {
  const userId = getHeaderUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    fullName?: string;
    email?: string;
  };

  const name = String(body?.fullName || "").trim();
  if (!name) {
    return NextResponse.json(
      { error: "Nome completo obrigatorio" },
      { status: 400 }
    );
  }

  const db = getDb();
  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.clerkId, userId))
    .limit(1);

  const existingRole = normalizeUserRole(existing[0]?.role);

  await db
    .insert(schema.users)
    .values({
      clerkId: userId,
      primaryEmail: body?.email || existing[0]?.primaryEmail || "",
      fullName: name,
      role: existingRole,
    })
    .onConflictDoUpdate({
      target: schema.users.clerkId,
      set: {
        fullName: name,
        primaryEmail: body?.email || existing[0]?.primaryEmail || "",
      },
    });

  return NextResponse.json({ success: true, role: existingRole });
}
