import { and, desc, eq, gte, lte } from "drizzle-orm";
import { sql } from "drizzle-orm";
import * as schema from "@/db/pgSchema";

export async function ensureReadingGoalsTable(db: any) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_reading_goals (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      title VARCHAR(160),
      target_books INTEGER NOT NULL DEFAULT 0,
      target_pages INTEGER NOT NULL DEFAULT 0,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      archived BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

export const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);

export const getCurrentMonthRange = () => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  };
};

export async function getReadingGoalsForUser(db: any, userId: string) {
  await ensureReadingGoalsTable(db);
  return db
    .select()
    .from(schema.userReadingGoals)
    .where(eq(schema.userReadingGoals.userId, userId))
    .orderBy(desc(schema.userReadingGoals.updatedAt), desc(schema.userReadingGoals.createdAt));
}

export async function computeGoalProgress(db: any, goal: any) {
  if (!goal) {
    return {
      booksCompleted: 0,
      pagesRead: 0,
      booksPercent: 0,
      pagesPercent: 0,
      overallPercent: 0,
    };
  }

  const progressRows = await db
    .select()
    .from(schema.userReadingProgress)
    .where(
      and(
        eq(schema.userReadingProgress.userId, goal.userId),
        gte(schema.userReadingProgress.lastReadAt, new Date(`${goal.startDate}T00:00:00.000Z`)),
        lte(schema.userReadingProgress.lastReadAt, new Date(`${goal.endDate}T23:59:59.999Z`))
      )
    );

  const completedRows = progressRows.filter((row: any) => {
    if (!row.isCompleted || !row.completedAt) return false;
    const completedAt = new Date(row.completedAt);
    return (
      completedAt >= new Date(`${goal.startDate}T00:00:00.000Z`) &&
      completedAt <= new Date(`${goal.endDate}T23:59:59.999Z`)
    );
  });

  const booksCompleted = completedRows.length;
  const pagesRead = progressRows.reduce(
    (total: number, row: any) => total + Math.max(Number(row.maxPageRead || 0), Number(row.currentPage || 0)),
    0
  );
  const booksPercent = goal.targetBooks > 0 ? Math.min(100, Math.round((booksCompleted / goal.targetBooks) * 100)) : 0;
  const pagesPercent = goal.targetPages > 0 ? Math.min(100, Math.round((pagesRead / goal.targetPages) * 100)) : 0;

  const activeTargets = [goal.targetBooks > 0 ? booksPercent : null, goal.targetPages > 0 ? pagesPercent : null].filter(
    (value) => value !== null
  ) as number[];

  return {
    booksCompleted,
    pagesRead,
    booksPercent,
    pagesPercent,
    overallPercent: activeTargets.length
      ? Math.round(activeTargets.reduce((sum, value) => sum + value, 0) / activeTargets.length)
      : 0,
  };
}
