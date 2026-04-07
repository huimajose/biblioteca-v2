import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";
import {
  computeGoalProgress,
  ensureReadingGoalsTable,
  getCurrentMonthRange,
  getReadingGoalsForUser,
} from "@/app/api/_utils/readingGoals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readPayload(userId: string) {
  const db = getDb();
  const goals = await getReadingGoalsForUser(db, userId);
  const activeGoal = goals.find((goal: any) => !goal.archived) || null;
  const activeProgress = await computeGoalProgress(db, activeGoal);

  return {
    activeGoal: activeGoal
      ? {
          ...activeGoal,
          progress: activeProgress,
        }
      : null,
    recentGoals: goals.slice(0, 5),
  };
}

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || "";
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  return NextResponse.json(await readPayload(userId));
}

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || "";
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    id?: number;
    title?: string;
    targetBooks?: number;
    targetPages?: number;
    startDate?: string;
    endDate?: string;
  };

  const title = String(body.title || "").trim();
  const targetBooks = Math.max(0, Number(body.targetBooks || 0));
  const targetPages = Math.max(0, Number(body.targetPages || 0));
  const defaultRange = getCurrentMonthRange();
  const startDate = String(body.startDate || defaultRange.startDate);
  const endDate = String(body.endDate || defaultRange.endDate);

  if (!targetBooks && !targetPages) {
    return NextResponse.json({ error: "Defina pelo menos uma meta de livros ou paginas." }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) {
    return NextResponse.json({ error: "Periodo de meta invalido." }, { status: 400 });
  }

  const db = getDb();
  await ensureReadingGoalsTable(db);

  const id = Number(body.id || 0);
  const now = new Date();

  if (id > 0) {
    await db
      .update(schema.userReadingGoals)
      .set({
        title: title || null,
        targetBooks,
        targetPages,
        startDate,
        endDate,
        updatedAt: now,
      })
      .where(eq(schema.userReadingGoals.id, id));
  } else {
    await db
      .insert(schema.userReadingGoals)
      .values({
        userId,
        title: title || null,
        targetBooks,
        targetPages,
        startDate,
        endDate,
        archived: false,
        createdAt: now,
        updatedAt: now,
      });
  }

  return NextResponse.json(await readPayload(userId));
}
