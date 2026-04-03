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

  if (verified === "true") {
    const verifications = await db.select().from(schema.studentVerifications);
    const approvedIds = new Set(
      verifications
        .filter((s) => String(s.status || "").toLowerCase() === "approved")
        .map((s) => s.clerkId)
    );
    users = users.filter(
      (u) =>
        approvedIds.has(u.clerkId) &&
        String(u.role || "").toLowerCase() === "student"
    );
  }

  const mapped = users.map((u) => ({
    clerkId: u.clerkId,
    primaryEmail: u.primaryEmail,
    fullName: u.fullName ?? "",
    role: u.role ?? "external",
  }));

  return NextResponse.json(mapped);
}
