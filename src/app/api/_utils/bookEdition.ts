import { sql } from 'drizzle-orm';
import type { getDb } from './db';

export async function ensureBooksEditionUniqueConstraint(db: ReturnType<typeof getDb>) {
  // Constraint-backed indexes must be removed via ALTER TABLE, not DROP INDEX.
  // Keep this migration atomic so a failure never removes uniqueness protection.
  await db.execute(sql`
    DO $$
    DECLARE item RECORD;
    BEGIN
      UPDATE books_temp SET edicao = 1 WHERE edicao IS NULL;
      ALTER TABLE books_temp ALTER COLUMN edicao SET DEFAULT 1;
      CREATE UNIQUE INDEX IF NOT EXISTS books_temp_isbn_edicao_unique ON books_temp (isbn, edicao);

      FOR item IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.conrelid = 'books_temp'::regclass AND c.contype = 'u'
          AND cardinality(c.conkey) = 1 AND a.attname = 'isbn'
      LOOP
        EXECUTE format('ALTER TABLE books_temp DROP CONSTRAINT %I', item.conname);
      END LOOP;

      FOR item IN
        SELECT ns.nspname, idx.relname
        FROM pg_index i
        JOIN pg_class idx ON idx.oid = i.indexrelid
        JOIN pg_namespace ns ON ns.oid = idx.relnamespace
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
        WHERE i.indrelid = 'books_temp'::regclass AND i.indisunique
          AND NOT i.indisprimary AND i.indnkeyatts = 1 AND a.attname = 'isbn'
          AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = i.indexrelid)
      LOOP
        EXECUTE format('DROP INDEX %I.%I', item.nspname, item.relname);
      END LOOP;
    END $$;
  `);
}
