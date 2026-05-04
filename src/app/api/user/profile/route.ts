import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";

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

  return NextResponse.json({ fullName: record[0]?.fullName ?? "" });
}

export async function POST(req: NextRequest) {
  const userId = getHeaderUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    fullName?: string;
    email?: string;
    role?: string;
  };

  const name = String(body?.fullName || "").trim();
  if (!name) {
    return NextResponse.json(
      { error: "Nome completo obrigatorio" },
      { status: 400 }
    );
  }

  const db = getDb();
  await db
    .insert(schema.users)
    .values({
      clerkId: userId,
      primaryEmail: body?.email || "",
      fullName: name,
      role: body?.role || "external",
    })
    .onConflictDoUpdate({
      target: schema.users.clerkId,
      set: {
        fullName: name,
        primaryEmail: body?.email || "",
        role: body?.role || "external",
      },
    });

  return NextResponse.json({ success: true });
}
