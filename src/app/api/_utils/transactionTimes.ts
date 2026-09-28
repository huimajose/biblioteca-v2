import { sql } from 'drizzle-orm';

// Keep legacy date columns intact. A trigger captures actual transitions atomically,
// including writes from older clients, without fabricating times for existing rows.
export async function ensureTransactionTimes(db: any) {
  await db.execute(sql`
    ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS borrowed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ
  `);
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION record_library_transaction_times()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        IF upper(NEW.status) = 'BORROWED' THEN
          NEW.borrowed_at := clock_timestamp();
        ELSIF upper(NEW.status) = 'RETURNED' THEN
          NEW.returned_at := clock_timestamp();
        END IF;
      ELSIF upper(NEW.status) IS DISTINCT FROM upper(OLD.status) THEN
        IF upper(NEW.status) = 'BORROWED' THEN
          NEW.borrowed_at := clock_timestamp();
        ELSIF upper(NEW.status) = 'RETURNED' THEN
          NEW.returned_at := clock_timestamp();
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$
  `);
  await db.execute(sql`
    CREATE OR REPLACE TRIGGER library_transaction_times
    BEFORE INSERT OR UPDATE OF status ON transactions
    FOR EACH ROW EXECUTE FUNCTION record_library_transaction_times()
  `);
}
