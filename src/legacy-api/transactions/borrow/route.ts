import { NextResponse } from 'next/server';
import { createPendingBorrow } from '@/db/crud/transactions.crud';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const headerUser = req.headers.get('x-user-id');
    const userId = body?.userId || headerUser;
    const bookId = Number(body?.bookId);

    if (!userId || !bookId) {
      return NextResponse.json({ error: 'Dados invalidos.' }, { status: 400 });
    }

    const result = await createPendingBorrow(bookId, userId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ message: result.message });
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
