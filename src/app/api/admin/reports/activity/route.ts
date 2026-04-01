import { NextResponse, NextRequest } from 'next/server';
import { listTransactions } from '@/db/crud/transactions.crud';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const includePending = searchParams.get('includePending') === 'true';

    const all = await listTransactions();
    const filtered = all.filter((t: any) => {
      if (!includePending && (t.status === 'pending' || t.status === 'rejected')) return false;
      if (!t.borrowedDate) return false;
      const date = new Date(t.borrowedDate).getTime();
      if (start) {
        const s = new Date(start).getTime();
        if (date < s) return false;
      }
      if (end) {
        const e = new Date(end).getTime();
        if (date > e + 24 * 60 * 60 * 1000 - 1) return false;
      }
      return true;
    });

    return NextResponse.json(filtered);
  } catch (err) {
    return NextResponse.json({ error: 'Erro ao gerar relatorio' }, { status: 500 });
  }
}
