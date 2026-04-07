import { and, eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";
import { appendAuditLog } from "@/app/api/_utils/audit";
import { notifyUser } from "@/app/api/_utils/notify";
import { PROLONGED_OVERDUE_DAYS, PROLONGED_OVERDUE_FINE_POINTS } from "@/constants";

type Db = ReturnType<typeof getDb>;

type OverdueItem = {
  tid: number;
  bookId: number | null;
  title: string;
  catalogCode: string | null;
  dueDate: string | null;
  overdueDays: number;
  fineApplied: boolean;
};

export type LoanSanctionsSummary = {
  blocked: boolean;
  reason: string | null;
  blockedItems: OverdueItem[];
  overdueItems: OverdueItem[];
  finePointsApplied: number;
  blockedThresholdDays: number;
  finePointsPerLoan: number;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const toDate = (value: unknown) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate());

const getOverdueDays = (dueDate: Date, now = new Date()) => {
  const diff = startOfDay(now).getTime() - startOfDay(dueDate).getTime();
  return Math.max(0, Math.floor(diff / ONE_DAY_MS));
};

const buildBlockReason = (items: OverdueItem[]) => {
  if (items.length === 0) return null;
  const maxDays = Math.max(...items.map((item) => item.overdueDays));
  const title = items[0]?.title || "um livro em atraso";
  if (items.length === 1) {
    return `Conta bloqueada: "${title}" esta ${maxDays} dia(s) em atraso.`;
  }
  return `Conta bloqueada: existem ${items.length} livros com atraso prolongado.`;
};

const ensureUserScoreRow = async (db: Db, userId: string) => {
  const [existing] = await db
    .select()
    .from(schema.userScores)
    .where(eq(schema.userScores.userId, userId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(schema.userScores)
    .values({
      userId,
      points: 100,
      lastUpdated: new Date(),
    })
    .returning();

  return created;
};

export async function applyLoanSanctions(db: Db, userId: string): Promise<LoanSanctionsSummary> {
  if (!userId) {
    return {
      blocked: false,
      reason: null,
      blockedItems: [],
      overdueItems: [],
      finePointsApplied: 0,
      blockedThresholdDays: PROLONGED_OVERDUE_DAYS,
      finePointsPerLoan: PROLONGED_OVERDUE_FINE_POINTS,
    };
  }

  const borrowedTransactions = await db
    .select()
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.userId, userId),
        eq(schema.transactions.status, "BORROWED")
      )
    );

  const overdueItems: OverdueItem[] = [];
  const newlyPenalizedTransactionIds: number[] = [];

  for (const transaction of borrowedTransactions) {
    const [physical] = await db
      .select()
      .from(schema.physicalBooks)
      .where(eq(schema.physicalBooks.pid, transaction.physicalBookId))
      .limit(1);

    const dueDate = toDate(physical?.returnDate);
    if (!dueDate) continue;

    const overdueDays = getOverdueDays(dueDate);
    if (overdueDays <= 0) continue;

    const [book] = physical?.bookId
      ? await db
          .select({
            id: schema.books.id,
            title: schema.books.title,
            catalogCode: schema.books.catalogCode,
          })
          .from(schema.books)
          .where(eq(schema.books.id, physical.bookId))
          .limit(1)
      : [];

    overdueItems.push({
      tid: transaction.tid,
      bookId: book?.id ?? null,
      title: book?.title || "Livro sem titulo",
      catalogCode: book?.catalogCode ?? null,
      dueDate: dueDate.toISOString(),
      overdueDays,
      fineApplied: Boolean(transaction.scoreApplied),
    });

    if (overdueDays >= PROLONGED_OVERDUE_DAYS && !transaction.scoreApplied) {
      newlyPenalizedTransactionIds.push(transaction.tid);
    }
  }

  let finePointsApplied = 0;
  if (newlyPenalizedTransactionIds.length > 0) {
    const score = await ensureUserScoreRow(db, userId);
    finePointsApplied =
      newlyPenalizedTransactionIds.length * PROLONGED_OVERDUE_FINE_POINTS;

    await db
      .update(schema.userScores)
      .set({
        points: Math.max((score?.points ?? 100) - finePointsApplied, 0),
        lastUpdated: new Date(),
      })
      .where(eq(schema.userScores.userId, userId));

    for (const transactionId of newlyPenalizedTransactionIds) {
      await db
        .update(schema.transactions)
        .set({ scoreApplied: true })
        .where(eq(schema.transactions.tid, transactionId));
    }

    await notifyUser(
      db,
      userId,
      "Multa por atraso prolongado",
      `Foram descontados ${finePointsApplied} ponto(s) por atraso prolongado em ${newlyPenalizedTransactionIds.length} emprestimo(s).`
    );
    await appendAuditLog(db, {
      actorUserId: "system",
      action: "apply-overdue-sanction",
      entityType: "user",
      entityId: userId,
      details: `Aplicada multa por atraso prolongado a ${userId}.`,
      metadata: {
        transactionIds: newlyPenalizedTransactionIds,
        finePointsApplied,
      },
    });
  }

  const blockedItems = overdueItems.filter(
    (item) => item.overdueDays >= PROLONGED_OVERDUE_DAYS
  );

  return {
    blocked: blockedItems.length > 0,
    reason: buildBlockReason(blockedItems),
    blockedItems,
    overdueItems,
    finePointsApplied,
    blockedThresholdDays: PROLONGED_OVERDUE_DAYS,
    finePointsPerLoan: PROLONGED_OVERDUE_FINE_POINTS,
  };
}
