import { boolean, date, integer, pgTable, serial, unique, varchar, timestamp } from 'drizzle-orm/pg-core';

export const verifyPending = pgTable('verifyPending', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  clerkId: varchar({ length: 255 }).notNull().unique(),
  email: varchar({ length: 255 }).notNull().unique(),
});

export const users = pgTable('users', {
  clerkId: varchar({ length: 255 }).primaryKey(),
  primaryEmail: varchar({ length: 255 }).notNull(),
  fullName: varchar('fullName', { length: 255 }).notNull().default(''),
  role: varchar({ length: 20 }),
});

export const admin = pgTable('admin', {
  clerkId: varchar({ length: 255 }).primaryKey().notNull(),
  primaryEmail: varchar({ length: 255 }).notNull(),
});

export const systemMetadata = pgTable('systemMetadata', {
  maxBooks: integer().notNull().default(4),
  maxDays: integer().notNull().default(15),
});

export const books = pgTable('books', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  author: varchar('author', { length: 255 }).notNull(),
  genre: varchar('genre', { length: 100 }).notNull(),
  isbn: varchar('isbn', { length: 13 }).notNull().unique(),
  totalCopies: integer('total_copies').notNull().default(0),
  availableCopies: integer('available_copies').notNull().default(0),
  cover: varchar('cover', { length: 255 }).notNull(),
  editora: varchar('editora', { length: 255 }),
  cdu: varchar('cdu', { length: 100 }),
  armario: varchar('armario', { length: 50 }),
  prateleira: integer('prateleira'),
  courseSequence: integer('course_sequence'),
  catalogCode: varchar('catalog_code', { length: 50 }),
  anoEdicao: integer('ano_edicao'),
  edicao: integer('edicao'),
  fileUrl: varchar('fileUrl', { length: 255 }),
  document_type: integer('document_type').notNull().default(1),
  is_digital: boolean('is_digital').notNull().default(false),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export const genres = pgTable('genres', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 20 }),
  displayOrder: integer('display_order'),
  defaultArmario: varchar('default_armario', { length: 50 }),
  shelfStart: integer('shelf_start'),
  shelfEnd: integer('shelf_end'),
});

export const transactions = pgTable('transactions', {
  tid: serial('tid').primaryKey(),
  physicalBookId: integer('physical_book_id').notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  adminId: varchar('admin_id', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  borrowedDate: date('borrowed_date'),
  returnedDate: date('returned_date'),
  user_name: varchar('user_name', { length: 255 }).notNull(),
  scoreApplied: boolean('score_applied').default(false),
});

export const physicalBooks = pgTable('physical_books', {
  pid: serial('pid').primaryKey(),
  bookId: integer('book_id').notNull(),
  borrowed: boolean('borrowed').notNull().default(false),
  returnDate: date('return_date'),
  userId: varchar('user_id', { length: 255 }),
  currTransactionId: integer('curr_transaction_id').notNull(),
});

export const userDigitalBooks = pgTable('user_digital_books', {
  id: serial('id').primaryKey(),
  bookId: integer('book_id').notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  favorite: boolean('favorite').notNull().default(false),
  addedAt: timestamp('added_at').notNull().defaultNow(),
});

export const userBookFavorites = pgTable('user_book_favorites', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  bookId: integer('book_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userBookFavoriteUnique: unique('user_book_favorites_user_book_unique').on(table.userId, table.bookId),
}));

export const userReadingLists = pgTable('user_reading_lists', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  description: varchar('description', { length: 500 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const userReadingListItems = pgTable('user_reading_list_items', {
  id: serial('id').primaryKey(),
  listId: integer('list_id').notNull(),
  bookId: integer('book_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  listBookUnique: unique('user_reading_list_items_list_book_unique').on(table.listId, table.bookId),
}));

export const userReadingProgress = pgTable('user_reading_progress', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  bookId: integer('book_id').notNull(),
  currentPage: integer('current_page').notNull().default(1),
  maxPageRead: integer('max_page_read').notNull().default(1),
  totalPages: integer('total_pages').notNull().default(0),
  progressPercent: integer('progress_percent').notNull().default(0),
  isCompleted: boolean('is_completed').notNull().default(false),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  lastReadAt: timestamp('last_read_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  userBookUnique: unique('user_reading_progress_user_book_unique').on(table.userId, table.bookId),
}));

export const userReadingGoals = pgTable('user_reading_goals', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  title: varchar('title', { length: 160 }),
  targetBooks: integer('target_books').notNull().default(0),
  targetPages: integer('target_pages').notNull().default(0),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  archived: boolean('archived').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const bookClicks = pgTable('book_clicks', {
  id: serial('id').primaryKey(),
  bookId: integer('book_id').notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const userScores = pgTable('user_scores', {
  userId: varchar('user_id', { length: 255 }).primaryKey(),
  points: integer('points').notNull().default(100),
  lastUpdated: timestamp('last_updated').notNull().defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: serial().primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: varchar('message', { length: 500 }).notNull(),
  read: boolean('read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorUserId: varchar('actor_user_id', { length: 255 }).notNull(),
  actorRole: varchar('actor_role', { length: 30 }).notNull(),
  action: varchar('action', { length: 120 }).notNull(),
  entityType: varchar('entity_type', { length: 60 }).notNull(),
  entityId: varchar('entity_id', { length: 255 }),
  details: varchar('details', { length: 500 }).notNull(),
  metadata: varchar('metadata', { length: 4000 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  endpoint: varchar('endpoint', { length: 500 }).notNull(),
  p256dh: varchar('p256dh', { length: 255 }).notNull(),
  auth: varchar('auth', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notificationSettings = pgTable('notification_settings', {
  userId: varchar('user_id', { length: 255 }).primaryKey(),
  pushEnabled: boolean('push_enabled').default(true).notNull(),
  lastSeenAt: timestamp('last_seen_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const studentVerifications = pgTable('student_verifications', {
  id: serial('id').primaryKey(),
  clerkId: varchar('clerk_id', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }),
  studentNumber: varchar('student_number', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').notNull(),
  verifiedAt: timestamp('verified_at'),
});

export const studentsVerifications = pgTable('student_verifications', {
  id: serial('id').primaryKey(),
  clerkId: varchar('clerk_id', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }),
  studentNumber: varchar('student_number', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').notNull(),
  verifiedAt: timestamp('verified_at'),
});
