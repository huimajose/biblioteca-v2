import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";
import { notifyUser } from "@/app/api/_utils/notify";
import { appendAuditLog, resolveActorRole } from "@/app/api/_utils/audit";
import { canAccessAdminSection } from "@/utils/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const verified = searchParams.get("verified");

  const db = getDb();
  const actorUserId = req.headers.get("x-user-id") || "";
  const actorRole = await resolveActorRole(db, actorUserId);
  const canReadUsers = verified === "true"
    ? canAccessAdminSection(actorRole, "transactions") || actorRole === "admin"
    : actorRole === "admin";
  if (!canReadUsers) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  let users = await db.select().from(schema.users);

  let verifications: Array<typeof schema.studentVerifications.$inferSelect> = [];
  let approvedIds: Set<string> | null = null;

  if (verified === "true") {
    verifications = await db.select().from(schema.studentVerifications);
    approvedIds = new Set(
      verifications
        .filter((s) => {
          const status = String(s.status || "").toLowerCase();
          return status === "approved" || status === "aprroved";
        })
        .map((s) => s.clerkId)
    );

    if (approvedIds.size > 0) {
      users = users.filter(
        (u) => approvedIds?.has(u.clerkId)
      );
    }
  }

  let mapped = users.map((u) => ({
    clerkId: u.clerkId,
    primaryEmail: u.primaryEmail,
    fullName: u.fullName ?? "",
    role: u.role ?? "external",
  }));

  if (verified === "true" && mapped.length === 0 && approvedIds?.size) {
    mapped = verifications
      .filter((v) => approvedIds?.has(v.clerkId))
      .map((v) => ({
        clerkId: v.clerkId,
        primaryEmail: "",
        fullName: v.fullName ?? "",
        role: "student",
      }));
  }

  return NextResponse.json(mapped);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const actorUserId = req.headers.get("x-user-id") || "";
  const clerkId = String(body?.clerkId || "").trim();
  if (!clerkId) {
    return NextResponse.json({ error: "clerkId requerido" }, { status: 400 });
  }

  const fullName = String(body?.fullName || "").trim();
  const primaryEmail = String(body?.primaryEmail || "").trim();
  const rawRole = String(body?.role || "external").toLowerCase();
  const role =
    rawRole === "admin" || rawRole === "operator" || rawRole === "catalogador" || rawRole === "student" || rawRole === "external"
      ? rawRole
      : "external";

  const db = getDb();
  const actorRole = await resolveActorRole(db, actorUserId);
  if (actorRole !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const existingUser = await db.select().from(schema.users).where(eq(schema.users.clerkId, clerkId)).limit(1);
  await db
    .insert(schema.users)
    .values({
      clerkId,
      fullName,
      primaryEmail,
      role,
    })
    .onConflictDoUpdate({
      target: schema.users.clerkId,
      set: {
        fullName,
        primaryEmail,
        role,
      },
    });

  await notifyUser(
    db,
    clerkId,
    "Conta atualizada",
    `Os dados da sua conta foram atualizados. Perfil atual: ${role}.`
  );

  if (actorUserId && actorUserId !== clerkId) {
    await notifyUser(
      db,
      actorUserId,
      "Utilizador atualizado",
      `Os dados de ${fullName || primaryEmail || clerkId} foram atualizados com sucesso.`
    );
  }

  await appendAuditLog(db, {
    actorUserId,
    action: existingUser[0] ? "update-user-role" : "create-user-role",
    entityType: "user",
    entityId: clerkId,
    details: existingUser[0]
      ? `Perfil de ${fullName || primaryEmail || clerkId} alterado para ${role}.`
      : `Conta ${fullName || primaryEmail || clerkId} criada com perfil ${role}.`,
    metadata: {
      previousRole: existingUser[0]?.role || null,
      nextRole: role,
    },
  });

  return NextResponse.json({ success: true });
}
