import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const verifyPending = sqliteTable(
  "verifyPending",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clerkId: text("clerkId").notNull().unique(),
    email: text("email").notNull().unique(),
  }
);

export const admin = sqliteTable("admin", {
  clerkId: text("clerkId").primaryKey().notNull(),
  primaryEmail: text("primaryEmail").notNull(),
});

export const systemMetadata = sqliteTable("systemMetadata", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  maxBooks: integer("maxBooks").default(4).notNull(),
  maxDays: integer("maxDays").default(15).notNull(),
});

export const users = sqliteTable("users", {
  clerkId: text("clerkId").primaryKey().notNull(),
  primaryEmail: text("primaryEmail").notNull(),
  fullName: text("fullName").default("").notNull(),
  role: text("role").default("external").notNull(), // admin, student, external
  status: text("status").default("active").notNull(), // active, suspended
  createdAt: text("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const books = sqliteTable(
  "books",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    author: text("author").notNull(),
    genre: text("genre").notNull(),
    genreId: integer("genre_id").default(1),
    totalCopies: integer("total_copies").default(0).notNull(),
    availableCopies: integer("available_copies").default(0).notNull(),
    cover: text("cover").notNull(), // URL or base64
    editora: text("editora"),
    cdu: text("cdu"),
    prateleira: integer("prateleira"),
    anoEdicao: integer("ano_edicao"),
    edicao: integer("edicao"),
    isbn: text("isbn").notNull().unique(),
    fileUrl: text("fileUrl"), // For digital books
    documentType: integer("document_type").default(1).notNull(), // 1 for physical, 2 for digital
    isDigital: integer("is_digital", { mode: "boolean" }).default(false).notNull(),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  }
);

export const physicalBooks = sqliteTable("physical_books", {
  pid: integer("pid").primaryKey({ autoIncrement: true }),
  bookId: integer("book_id").notNull().references(() => books.id),
  borrowed: integer("borrowed", { mode: "boolean" }).default(false).notNull(),
  returnDate: text("return_date"),
  userId: text("user_id").references(() => users.clerkId),
  currTransactionId: integer("curr_transaction_id"),
});

export const transactions = sqliteTable("transactions", {
  tid: integer("tid").primaryKey({ autoIncrement: true }),
  physicalBookId: integer("physical_book_id").references(() => physicalBooks.pid),
  bookId: integer("book_id").references(() => books.id),
  userId: text("user_id").notNull(),
  adminId: text("admin_id").notNull(),
  status: text("status").notNull(), // borrowed, returned, overdue
  borrowedDate: text("borrowed_date").default(sql`CURRENT_TIMESTAMP`).notNull(),
  returnedDate: text("returned_date"),
  scoreApplied: integer("score_applied", { mode: "boolean" }).default(false).notNull(),
});

export const userDigitalBooks = sqliteTable(
  "user_digital_books",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.clerkId, { onDelete: "cascade" }),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    addedAt: text("added_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  }
);

export const reservations = sqliteTable("reservations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => users.clerkId, { onDelete: "cascade" }),
  bookId: integer("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  requestedAt: text("requested_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  status: text("status").default("pending").notNull(), // pending, available, fulfilled, cancelled
});
