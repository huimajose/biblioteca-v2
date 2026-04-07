import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/app/api/_utils/db";
import { readAuditLogs, resolveActorRole } from "@/app/api/_utils/audit";
import * as schema from "@/db/pgSchema";

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
  const enrichedLogs = await Promise.all(
    logs.map(async (log) => {
      const [user] = log.actorUserId
        ? await db
            .select({
              fullName: schema.users.fullName,
              primaryEmail: schema.users.primaryEmail,
            })
            .from(schema.users)
            .where(eq(schema.users.clerkId, log.actorUserId))
            .limit(1)
        : [];

      return {
        ...log,
        actorName:
          String(user?.fullName || "").trim() ||
          String(user?.primaryEmail || "").trim() ||
          log.actorUserId,
      };
    })
  );

  return NextResponse.json(enrichedLogs);
}
