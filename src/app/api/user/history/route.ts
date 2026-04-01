import { NextResponse } from 'next/server';
import { listTransactions } from '@/db/crud/transactions.crud';

export async function GET(req: Request) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'User ID missing' }, { status: 400 });
    }

    const all = await listTransactions();
    const history = all.filter((t: any) =>
      t.userId === userId && (t.status === 'borrowed' || t.status === 'returned')
    );

    return NextResponse.json(history);
  } catch (err) {
    return NextResponse.json({ error: 'Erro ao carregar historico' }, { status: 500 });
  }
}
