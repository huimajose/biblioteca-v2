import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { STUDENT_BORROW_LIMIT, EXTERNAL_BORROW_LIMIT } from '@/constants';
import { getUserRole } from '@/utils/roles';

const ADMIN_FALLBACK_ID = 'admin';

async function getBorrowLimit(userId: string) {
  const role = await getUserRole(userId);
  if (role === 'student') return STUDENT_BORROW_LIMIT;
  if (role === 'admin') return STUDENT_BORROW_LIMIT;
  return EXTERNAL_BORROW_LIMIT;
}

function countActiveForUser(userId: string) {
  const all = db
    .select()
    .from(schema.transactions)
    .where(eq(schema.transactions.userId, userId))
    .all();
  return all.filter((t: any) => t.status === 'borrowed' || t.status === 'pending').length;
}

function ensurePhysicalCopies(bookId: number, totalCopies: number) {
  const existing = db
    .select()
    .from(schema.physicalBooks)
    .where(eq(schema.physicalBooks.bookId, bookId))
    .all();
  const missing = Math.max(0, totalCopies - existing.length);
  if (missing <= 0) return;
  const values = Array.from({ length: missing }).map(() => ({
    bookId,
    borrowed: false,
    returnDate: null,
    userId: null,
    currTransactionId: null,
  }));
  db.insert(schema.physicalBooks).values(values).run();
}

function getAvailablePhysicalCopy(bookId: number) {
  return db
    .select()
    .from(schema.physicalBooks)
    .where(and(eq(schema.physicalBooks.bookId, bookId), eq(schema.physicalBooks.borrowed, false)))
    .get();
}

export async function createPendingBorrow(bookId: number, userId: string) {
  const book = db.select().from(schema.books).where(eq(schema.books.id, bookId)).get();
  if (!book) return { success: false, error: 'Livro nao encontrado.' };
  if (book.isDigital) return { success: false, error: 'Livro digital nao requer emprestimo.' };
  if ((book.availableCopies ?? 0) <= 0) return { success: false, error: 'Sem exemplares disponiveis.' };

  const limit = await getBorrowLimit(userId);
  const active = countActiveForUser(userId);
  if (active >= limit) {
    return { success: false, error: `Limite de emprestimos atingido (${limit}).` };
  }

  const result = db.insert(schema.transactions).values({
    bookId,
    userId,
    adminId: 'pending',
    status: 'pending',
    borrowedDate: new Date().toISOString(),
  }).run();

  return { success: true, message: 'Pedido enviado para aprovacao.', tid: result.lastInsertRowid };
}

export async function createImmediateBorrow(bookId: number, userId: string, adminId?: string) {
  const book = db.select().from(schema.books).where(eq(schema.books.id, bookId)).get();
  if (!book) return { success: false, error: 'Livro nao encontrado.' };
  if (book.isDigital) return { success: false, error: 'Livro digital nao requer emprestimo.' };

  const available = Number(book.availableCopies ?? 0);
  if (available <= 0) return { success: false, error: 'Sem exemplares disponiveis.' };

  ensurePhysicalCopies(bookId, Number(book.totalCopies ?? 0));
  const physical = getAvailablePhysicalCopy(bookId);
  if (!physical) return { success: false, error: 'Nao ha exemplar fisico disponivel.' };

  const admin = adminId || ADMIN_FALLBACK_ID;
  const tx = db.insert(schema.transactions).values({
    bookId,
    userId,
    adminId: admin,
    status: 'borrowed',
    borrowedDate: new Date().toISOString(),
    physicalBookId: physical.pid,
  }).run();

  db.update(schema.physicalBooks)
    .set({ borrowed: true, userId, currTransactionId: Number(tx.lastInsertRowid) })
    .where(eq(schema.physicalBooks.pid, physical.pid))
    .run();

  db.update(schema.books)
    .set({ availableCopies: Math.max(0, available - 1) })
    .where(eq(schema.books.id, bookId))
    .run();

  return { success: true, tid: Number(tx.lastInsertRowid) };
}

export async function acceptBorrowRequest(tid: number, adminId?: string) {
  const tx = db.select().from(schema.transactions).where(eq(schema.transactions.tid, tid)).get();
  if (!tx) return { success: false, error: 'Transacao nao encontrada.' };
  if (tx.status !== 'pending') return { success: false, error: 'Transacao nao esta pendente.' };
  if (!tx.bookId) return { success: false, error: 'Livro nao definido para esta transacao.' };

  const book = db.select().from(schema.books).where(eq(schema.books.id, tx.bookId)).get();
  if (!book) return { success: false, error: 'Livro nao encontrado.' };
  const available = Number(book.availableCopies ?? 0);
  if (available <= 0) return { success: false, error: 'Sem exemplares disponiveis.' };

  ensurePhysicalCopies(tx.bookId, Number(book.totalCopies ?? 0));
  const physical = getAvailablePhysicalCopy(tx.bookId);
  if (!physical) return { success: false, error: 'Nao ha exemplar fisico disponivel.' };

  db.update(schema.transactions)
    .set({
      status: 'borrowed',
      adminId: adminId || ADMIN_FALLBACK_ID,
      physicalBookId: physical.pid,
      borrowedDate: new Date().toISOString(),
      returnedDate: null,
    })
    .where(eq(schema.transactions.tid, tid))
    .run();

  db.update(schema.physicalBooks)
    .set({ borrowed: true, userId: tx.userId, currTransactionId: tid })
    .where(eq(schema.physicalBooks.pid, physical.pid))
    .run();

  db.update(schema.books)
    .set({ availableCopies: Math.max(0, available - 1) })
    .where(eq(schema.books.id, tx.bookId))
    .run();

  return { success: true };
}

export async function rejectBorrowRequest(tid: number, adminId?: string) {
  const tx = db.select().from(schema.transactions).where(eq(schema.transactions.tid, tid)).get();
  if (!tx) return { success: false, error: 'Transacao nao encontrada.' };
  if (tx.status !== 'pending') return { success: false, error: 'Transacao nao esta pendente.' };

  db.update(schema.transactions)
    .set({
      status: 'rejected',
      adminId: adminId || ADMIN_FALLBACK_ID,
      returnedDate: new Date().toISOString(),
    })
    .where(eq(schema.transactions.tid, tid))
    .run();

  return { success: true };
}

export async function returnBorrowedBook(tid: number) {
  const tx = db.select().from(schema.transactions).where(eq(schema.transactions.tid, tid)).get();
  if (!tx) return { success: false, error: 'Transacao nao encontrada.' };
  if (tx.status !== 'borrowed') return { success: false, error: 'Transacao nao esta emprestada.' };

  if (tx.physicalBookId) {
    db.update(schema.physicalBooks)
      .set({ borrowed: false, userId: null, returnDate: null, currTransactionId: null })
      .where(eq(schema.physicalBooks.pid, tx.physicalBookId))
      .run();
  }

  db.update(schema.transactions)
    .set({ status: 'returned', returnedDate: new Date().toISOString() })
    .where(eq(schema.transactions.tid, tid))
    .run();

  if (tx.bookId) {
    const book = db.select().from(schema.books).where(eq(schema.books.id, tx.bookId)).get();
    if (book && !book.isDigital) {
      const available = Number(book.availableCopies ?? 0);
      db.update(schema.books)
        .set({ availableCopies: available + 1 })
        .where(eq(schema.books.id, tx.bookId))
        .run();
    }
  }

  return { success: true };
}

export async function listTransactions() {
  const txs = db.select().from(schema.transactions).all();
  const books = db.select().from(schema.books).all();
  const bookMap = new Map<number, any>(books.map((b: any) => [b.id, b]));
  const physicals = db.select().from(schema.physicalBooks).all();
  const physicalMap = new Map<number, any>(physicals.map((p: any) => [p.pid, p]));
  const users = db.select().from(schema.users).all();
  const userMap = new Map<string, any>(users.map((u: any) => [u.clerkId, u]));
  const verifications = db.select().from(schema.studentVerifications).all();
  const verificationMap = new Map<string, any>(verifications.map((v: any) => [v.clerkId, v]));

  return txs.map((t: any) => {
    const physical = t.physicalBookId ? physicalMap.get(t.physicalBookId) : null;
    const bookId = t.bookId || physical?.bookId;
    const book = bookId ? bookMap.get(bookId) : null;
    const user = userMap.get(t.userId);
    const verification = verificationMap.get(t.userId);
    return {
      ...t,
      userName: user?.fullName || verification?.fullName || null,
      userEmail: user?.primaryEmail || null,
      bookTitle: book?.title || 'N/D',
      bookAuthor: book?.author || 'N/D',
      isbn: book?.isbn || undefined,
      physicalBookId: t.physicalBookId || physical?.pid || null,
    };
  });
}

export async function listUserReports() {
  const users = db.select().from(schema.users).all();
  const txs = await listTransactions();

  return users.map((u: any) => {
    const activeBorrows = txs.filter((t: any) => t.userId === u.clerkId && t.status === 'borrowed');
    return {
      ...u,
      activeBorrows,
    };
  });
}

export async function canUserBorrowMore(userId: string, additional = 1) {
  const limit = await getBorrowLimit(userId);
  const active = countActiveForUser(userId);
  return { ok: active + additional <= limit, limit, active };
}

export async function getTransactionById(tid: number) {
  const all = await listTransactions();
  return all.find((t: any) => t.tid === tid) || null;
}
