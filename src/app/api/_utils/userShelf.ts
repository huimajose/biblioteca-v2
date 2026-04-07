import { sql } from "drizzle-orm";
import { getDb } from "@/app/api/_utils/db";

type Db = ReturnType<typeof getDb>;

export async function ensureUserShelfFavoriteColumn(db: Db) {
  await db.execute(sql`
    ALTER TABLE user_digital_books
    ADD COLUMN IF NOT EXISTS favorite boolean NOT NULL DEFAULT false
  `);
}
