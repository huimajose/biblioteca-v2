import { acceptBorrowRequest, rejectBorrowRequest } from '@/db/crud/transactions.crud';

export async function acceptTransaction(tid: number, _userId?: string, adminId?: string) {
  return acceptBorrowRequest(tid, adminId);
}

export async function rejectTransaction(tid: number, _userId?: string, adminId?: string) {
  return rejectBorrowRequest(tid, adminId);
}
