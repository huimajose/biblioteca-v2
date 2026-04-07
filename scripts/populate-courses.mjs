import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('Missing DATABASE_URL in environment variables.');
}

const sql = neon(databaseUrl);

const predefinedCourses = [
  { name: 'Eng. Informática', code: 'INF', displayOrder: 1, defaultArmario: '1' },
  { name: 'Ensino Primário', code: 'EPR', displayOrder: 2, defaultArmario: '2' },
  { name: 'Info. Gest. Empresas', code: 'IGE', displayOrder: 3, defaultArmario: '3' },
  { name: 'Finanças e Contabilidades', code: 'FIC', displayOrder: 4, defaultArmario: '4' },
  { name: 'Direito', code: 'DIR', displayOrder: 5, defaultArmario: '5' },
  { name: 'C. Comunicação', code: 'COM', displayOrder: 6, defaultArmario: '6' },
  { name: 'Gest. Marketing', code: 'MKT', displayOrder: 7, defaultArmario: '7' },
  { name: 'Sociologia', code: 'SOC', displayOrder: 8, defaultArmario: '8' },
  { name: 'Geral', code: 'GER', displayOrder: 9, defaultArmario: '9' },
];

const slugify = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim();

const buildCode = (name) => {
  const words = slugify(name)
    .split(/\s+/)
    .filter(Boolean);
  const compact = words.map((word) => word[0]).join('').toUpperCase();
  return (compact || 'CUR').slice(0, 6);
};

await sql`
  ALTER TABLE genres
  ADD COLUMN IF NOT EXISTS code varchar(20),
  ADD COLUMN IF NOT EXISTS display_order integer,
  ADD COLUMN IF NOT EXISTS default_armario varchar(50),
  ADD COLUMN IF NOT EXISTS shelf_start integer,
  ADD COLUMN IF NOT EXISTS shelf_end integer
`;

for (const course of predefinedCourses) {
  await sql`
    INSERT INTO genres (name, code, display_order, default_armario)
    VALUES (${course.name}, ${course.code}, ${course.displayOrder}, ${course.defaultArmario})
    ON CONFLICT DO NOTHING
  `;
}

const existing = await sql`
  SELECT id, name, code, display_order, default_armario
  FROM genres
  ORDER BY name
`;

const usedCodes = new Set(
  existing
    .map((row) => String(row.code || '').trim().toUpperCase())
    .filter(Boolean)
);

let nextOrder = predefinedCourses.length + 1;

for (const row of existing) {
  const matched = predefinedCourses.find((course) => course.name === row.name);
  let code = matched?.code || String(row.code || '').trim().toUpperCase();

  if (!code) {
    code = buildCode(row.name);
    let suffix = 1;
    let candidate = code;
    while (usedCodes.has(candidate)) {
      candidate = `${code}${suffix}`;
      suffix += 1;
    }
    code = candidate;
  }

  usedCodes.add(code);

  const displayOrder = matched?.displayOrder ?? row.display_order ?? nextOrder;
  if (!matched && !row.display_order) {
    nextOrder += 1;
  }

  const defaultArmario =
    matched?.defaultArmario ??
    String(row.default_armario || row.display_order || displayOrder || '');

  await sql`
    UPDATE genres
    SET code = ${code},
        display_order = ${displayOrder},
        default_armario = ${defaultArmario},
        shelf_start = COALESCE(shelf_start, NULL),
        shelf_end = COALESCE(shelf_end, NULL)
    WHERE id = ${row.id}
  `;
}

const updated = await sql`
  SELECT id, name, code, display_order, default_armario, shelf_start, shelf_end
  FROM genres
  ORDER BY display_order NULLS LAST, name
`;

console.log(JSON.stringify(updated, null, 2));
