import { sql } from "drizzle-orm";
import { getDb } from "@/app/api/_utils/db";

type Db = ReturnType<typeof getDb>;

export async function ensureUserReadingListsTables(db: Db) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_reading_lists (
      id serial PRIMARY KEY,
      user_id varchar(255) NOT NULL,
      name varchar(120) NOT NULL,
      description varchar(500),
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_reading_list_items (
      id serial PRIMARY KEY,
      list_id integer NOT NULL,
      book_id integer NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT user_reading_list_items_list_book_unique UNIQUE (list_id, book_id)
    )
  `);
}
