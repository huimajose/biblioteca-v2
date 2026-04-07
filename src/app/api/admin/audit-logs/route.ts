import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/app/api/_utils/db";
import { readAuditLogs, resolveActorRole } from "@/app/api/_utils/audit";
import * as schema from "@/db/pgSchema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const parseMetadata = (metadata: unknown) => {
  if (!metadata) return null;
  if (typeof metadata === "object") return metadata as Record<string, unknown>;
  if (typeof metadata !== "string") return null;
  try {
    const parsed = JSON.parse(metadata);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const getUserIdFromUnknown = (value: unknown) => {
  const normalized = String(value || "").trim();
  return normalized || null;
};

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
      const metadata = parseMetadata(log.metadata);
      const subjectUserId =
        getUserIdFromUnknown(metadata?.userId) ||
        (String(log.entityType || "").trim().toLowerCase() === "user"
          ? getUserIdFromUnknown(log.entityId)
          : null);

      const [actorUser] = log.actorUserId
        ? await db
            .select({
              fullName: schema.users.fullName,
              primaryEmail: schema.users.primaryEmail,
            })
            .from(schema.users)
            .where(eq(schema.users.clerkId, log.actorUserId))
            .limit(1)
        : [];

      const [subjectUser] = subjectUserId
        ? await db
            .select({
              fullName: schema.users.fullName,
              primaryEmail: schema.users.primaryEmail,
            })
            .from(schema.users)
            .where(eq(schema.users.clerkId, subjectUserId))
            .limit(1)
        : [];

      const actorName =
        String(actorUser?.fullName || "").trim() ||
        String(actorUser?.primaryEmail || "").trim() ||
        log.actorUserId;

      const subjectUserName = String(subjectUser?.fullName || "").trim();
      const subjectUserEmail = String(subjectUser?.primaryEmail || "").trim();
      const subjectUserDisplay =
        subjectUserName || subjectUserEmail || subjectUserId || "";

      return {
        ...log,
        actorName,
        subjectUserName,
        subjectUserEmail,
        detailDisplay: subjectUserDisplay
          ? `${String(log.details || "").trim() || "Sem detalhe."} Utilizador: ${subjectUserDisplay}.`
          : log.details,
      };
    })
  );

  return NextResponse.json(enrichedLogs);
}
