import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('Missing DATABASE_URL in environment variables.');
}

const sql = neon(databaseUrl);

await sql`
  ALTER TABLE books
  ADD COLUMN IF NOT EXISTS armario varchar(50),
  ADD COLUMN IF NOT EXISTS course_sequence integer,
  ADD COLUMN IF NOT EXISTS catalog_code varchar(50)
`;

await sql`
  INSERT INTO genres (name, code, display_order, default_armario)
  VALUES ('Geral', 'GER', 9, '9')
  ON CONFLICT DO NOTHING
`;

await sql`
  UPDATE books
  SET genre = 'Geral'
  WHERE genre IS NULL OR trim(genre) = '' OR trim(genre) = '0'
`;

await sql`
  WITH ranked AS (
    SELECT
      b.id,
      COALESCE(NULLIF(trim(b.armario), ''), NULLIF(trim(g.default_armario), ''), '9') AS next_armario,
      ROW_NUMBER() OVER (
        PARTITION BY b.genre
        ORDER BY
          CASE WHEN b.prateleira IS NULL THEN 1 ELSE 0 END,
          b.prateleira ASC,
          b.title ASC,
          b.id ASC
      )::int AS next_sequence,
      CONCAT(
        COALESCE(NULLIF(trim(g.code), ''), 'CUR'),
        '-',
        LPAD(
          ROW_NUMBER() OVER (
            PARTITION BY b.genre
            ORDER BY
              CASE WHEN b.prateleira IS NULL THEN 1 ELSE 0 END,
              b.prateleira ASC,
              b.title ASC,
              b.id ASC
          )::text,
          3,
          '0'
        )
      ) AS next_catalog_code
    FROM books b
    LEFT JOIN genres g ON g.name = b.genre
  )
  UPDATE books AS b
  SET
    armario = ranked.next_armario,
    course_sequence = ranked.next_sequence,
    catalog_code = ranked.next_catalog_code
  FROM ranked
  WHERE ranked.id = b.id
`;

const preview = await sql`
  SELECT id, title, genre, armario, prateleira, course_sequence, catalog_code
  FROM books
  ORDER BY genre, course_sequence NULLS LAST, id
  LIMIT 40
`;

console.log(JSON.stringify(preview, null, 2));
