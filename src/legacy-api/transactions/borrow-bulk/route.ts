import { NextResponse } from 'next/server';
import { canUserBorrowMore, createImmediateBorrow, getTransactionById } from '@/db/crud/transactions.crud';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const bookIds: number[] = Array.isArray(body?.bookIds) ? body.bookIds.map((id: any) => Number(id)) : [];
    const userId = body?.userId;

    if (!userId || bookIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Dados invalidos.' }, { status: 400 });
    }

    const limitCheck = await canUserBorrowMore(userId, bookIds.length);
    if (!limitCheck.ok) {
      return NextResponse.json({
        success: false,
        error: `Limite de emprestimos atingido (${limitCheck.limit}).`,
      }, { status: 400 });
    }

    const results: any[] = [];
    const errors: any[] = [];

    for (const bookId of bookIds) {
      const res = await createImmediateBorrow(bookId, userId, req.headers.get('x-admin-id') || undefined);
      if (res.success && res.tid) {
        const ticket = await getTransactionById(res.tid);
        if (ticket) results.push(ticket);
      } else {
        errors.push({ bookId, error: res.error || 'Falha ao processar.' });
      }
    }

    if (errors.length > 0 && results.length === 0) {
      return NextResponse.json({ success: false, errors }, { status: 400 });
    }

    return NextResponse.json({ success: true, results, errors });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}
