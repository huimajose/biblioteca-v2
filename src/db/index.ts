import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema.ts';

const sqlite = new Database('library.db');
export const db = drizzle(sqlite, { schema });

// Initialize database
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS verifyPending (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clerkId TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS admin (
    clerkId TEXT PRIMARY KEY NOT NULL,
    primaryEmail TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS systemMetadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    maxBooks INTEGER DEFAULT 4 NOT NULL,
    maxDays INTEGER DEFAULT 15 NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    clerkId TEXT PRIMARY KEY NOT NULL,
    primaryEmail TEXT NOT NULL,
    fullName TEXT DEFAULT '' NOT NULL,
    role TEXT DEFAULT 'external' NOT NULL,
    status TEXT DEFAULT 'active' NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
  );

  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    genre TEXT NOT NULL,
    genre_id INTEGER DEFAULT 1,
    total_copies INTEGER DEFAULT 0 NOT NULL,
    available_copies INTEGER DEFAULT 0 NOT NULL,
    cover TEXT NOT NULL,
    isbn TEXT NOT NULL UNIQUE,
    fileUrl TEXT,
    document_type INTEGER DEFAULT 1 NOT NULL,
    is_digital INTEGER DEFAULT 0 NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
  );

  CREATE TABLE IF NOT EXISTS physical_books (
    pid INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL REFERENCES books(id),
    borrowed INTEGER DEFAULT 0 NOT NULL,
    return_date TEXT,
    user_id TEXT REFERENCES users(clerkId),
    curr_transaction_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS transactions (
    tid INTEGER PRIMARY KEY AUTOINCREMENT,
    physical_book_id INTEGER REFERENCES physical_books(pid),
    book_id INTEGER REFERENCES books(id),
    user_id TEXT NOT NULL,
    admin_id TEXT NOT NULL,
    status TEXT NOT NULL,
    borrowed_date TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    returned_date TEXT,
    score_applied INTEGER DEFAULT 0 NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_digital_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(clerkId) ON DELETE CASCADE,
    book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    added_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(user_id, book_id)
  );
`);

// Seed initial admin if not exists
const existingAdmin = db.select().from(schema.admin).limit(1).get();
if (!existingAdmin) {
  db.insert(schema.admin).values({
    clerkId: 'admin_123',
    primaryEmail: 'admin@library.com'
  }).run();
  
  db.insert(schema.systemMetadata).values({
    maxBooks: 4,
    maxDays: 15
  }).run();
}

// Ensure new columns exist for legacy databases
try {
  sqlite.exec(`ALTER TABLE transactions ADD COLUMN book_id INTEGER REFERENCES books(id);`);
} catch {
  // Column already exists
}

try {
  sqlite.exec(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'external' NOT NULL;`);
} catch {
  // Column already exists
}

try {
  sqlite.exec(`ALTER TABLE users ADD COLUMN fullName TEXT DEFAULT '' NOT NULL;`);
} catch {
  // Column already exists
}
