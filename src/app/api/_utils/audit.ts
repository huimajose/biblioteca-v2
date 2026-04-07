import { desc, eq, sql } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { normalizeUserRole, type UserRole } from "@/utils/roles";
import { getDb } from "@/app/api/_utils/db";

type Db = ReturnType<typeof getDb>;

type AuditInput = {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  details: string;
  metadata?: Record<string, unknown> | null;
};

export async function ensureAuditTable(db: Db) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id serial PRIMARY KEY,
      actor_user_id varchar(255) NOT NULL,
      actor_role varchar(30) NOT NULL,
      action varchar(120) NOT NULL,
      entity_type varchar(60) NOT NULL,
      entity_id varchar(255),
      details varchar(500) NOT NULL,
      metadata varchar(4000),
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
}

export async function resolveActorRole(db: Db, userId: string): Promise<UserRole> {
  if (!userId) return "external";
  const [user] = await db
    .select({ role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.clerkId, userId))
    .limit(1);
  return normalizeUserRole(user?.role || "external");
}

export async function appendAuditLog(db: Db, input: AuditInput) {
  if (!input.actorUserId) return;
  await ensureAuditTable(db);
  const actorRole = await resolveActorRole(db, input.actorUserId);
  await db.insert(schema.auditLogs).values({
    actorUserId: input.actorUserId,
    actorRole,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId == null ? null : String(input.entityId),
    details: input.details,
    metadata: input.metadata ? JSON.stringify(input.metadata).slice(0, 4000) : null,
  });
}

export async function readAuditLogs(db: Db, limit = 200) {
  await ensureAuditTable(db);
  return db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt)).limit(limit);
}
