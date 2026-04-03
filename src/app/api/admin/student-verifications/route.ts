import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const pending = await db
    .select()
    .from(schema.studentVerifications)
    .orderBy(desc(schema.studentVerifications.createdAt));

  return NextResponse.json(pending);
}
