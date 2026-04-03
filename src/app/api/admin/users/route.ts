import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const verified = searchParams.get("verified");

  const db = getDb();
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
