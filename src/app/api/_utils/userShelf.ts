import { sql } from "drizzle-orm";
import { getDb } from "@/app/api/_utils/db";

type Db = ReturnType<typeof getDb>;

export async function ensureUserShelfFavoriteColumn(db: Db) {
  await db.execute(sql`
    ALTER TABLE user_digital_books
    ADD COLUMN IF NOT EXISTS favorite boolean NOT NULL DEFAULT false
  `);
}

export async function ensureUserFavoritesTable(db: Db) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_book_favorites (
      id serial PRIMARY KEY,
      user_id varchar(255) NOT NULL,
      book_id integer NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT user_book_favorites_user_book_unique UNIQUE (user_id, book_id)
    )
  `);

  await ensureUserShelfFavoriteColumn(db);

  await db.execute(sql`
    INSERT INTO user_book_favorites (user_id, book_id)
    SELECT user_id, book_id
    FROM user_digital_books
    WHERE favorite = true
    ON CONFLICT (user_id, book_id) DO NOTHING
  `);
}
