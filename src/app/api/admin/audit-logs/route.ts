import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/app/api/_utils/db";
import { readAuditLogs, resolveActorRole } from "@/app/api/_utils/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const actorUserId = req.headers.get("x-user-id") || "";
  const db = getDb();
  const actorRole = await resolveActorRole(db, actorUserId);

  if (actorRole !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const logs = await readAuditLogs(db, 300);
  return NextResponse.json(logs);
}
