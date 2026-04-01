import { NextResponse } from 'next/server';
import { returnBorrowedBook } from '@/db/crud/transactions.crud';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const transactionId = Number(body?.transactionId || body?.tid);

    if (!transactionId) {
      return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 });
    }

    const result = await returnBorrowedBook(transactionId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
