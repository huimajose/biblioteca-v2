import { and, eq, sql } from "drizzle-orm";
import * as schema from "@/db/pgSchema";

export const FREE_READING_PREVIEW_PAGES = 5;

export async function ensureReadingProgressTable(db: any) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_reading_progress (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      book_id INTEGER NOT NULL,
      current_page INTEGER NOT NULL DEFAULT 1,
      max_page_read INTEGER NOT NULL DEFAULT 1,
      total_pages INTEGER NOT NULL DEFAULT 0,
      progress_percent INTEGER NOT NULL DEFAULT 0,
      is_completed BOOLEAN NOT NULL DEFAULT FALSE,
      started_at TIMESTAMP NOT NULL DEFAULT NOW(),
      last_read_at TIMESTAMP NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMP NULL,
      UNIQUE (user_id, book_id)
    )
  `);
}

export async function getReadingProgressForBook(
  db: any,
  userId: string,
  bookId: number
) {
  await ensureReadingProgressTable(db);
  const progress = await db
    .select()
    .from(schema.userReadingProgress)
    .where(
      and(
        eq(schema.userReadingProgress.userId, userId),
        eq(schema.userReadingProgress.bookId, bookId)
      )
    )
    .limit(1);
  return progress[0] ?? null;
}

export async function upsertReadingProgress(
  db: any,
  input: {
    userId: string;
    bookId: number;
    currentPage: number;
    totalPages: number;
  }
) {
  await ensureReadingProgressTable(db);

  const existing = await getReadingProgressForBook(db, input.userId, input.bookId);
  const currentPage = Math.max(1, Number(input.currentPage || 1));
  const totalPages = Math.max(0, Number(input.totalPages || 0));
  const maxPageRead = Math.max(Number(existing?.maxPageRead || 1), currentPage);
  const progressPercent =
    totalPages > 0 ? Math.min(100, Math.round((currentPage / totalPages) * 100)) : 0;
  const isCompleted = totalPages > 0 && currentPage >= totalPages;
  const now = new Date();

  await db
    .insert(schema.userReadingProgress)
    .values({
      userId: input.userId,
      bookId: input.bookId,
      currentPage,
      maxPageRead,
      totalPages,
      progressPercent,
      isCompleted,
      startedAt: existing?.startedAt ?? now,
      lastReadAt: now,
      completedAt: isCompleted ? now : null,
    })
    .onConflictDoUpdate({
      target: [schema.userReadingProgress.userId, schema.userReadingProgress.bookId],
      set: {
        currentPage,
        maxPageRead,
        totalPages,
        progressPercent,
        isCompleted,
        lastReadAt: now,
        completedAt: isCompleted ? now : null,
      },
    });

  return getReadingProgressForBook(db, input.userId, input.bookId);
}
