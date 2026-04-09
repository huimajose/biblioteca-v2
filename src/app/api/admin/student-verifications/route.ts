import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";
import { ensureStudentVerificationCourseColumn } from "@/app/api/_utils/studentVerification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    await ensureStudentVerificationCourseColumn(db);
    const rows = await db
      .select()
      .from(schema.studentVerifications)
      .orderBy(desc(schema.studentVerifications.createdAt));

    const deduped = Array.from(
      rows.reduce((map, row) => {
        const key = String(row.clerkId || row.studentNumber || row.id);
        if (!map.has(key)) {
          map.set(key, row);
        }
        return map;
      }, new Map<string, (typeof rows)[number]>()).values()
    );

    return NextResponse.json(deduped);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao carregar pedidos" },
      { status: 500 }
    );
  }
}
