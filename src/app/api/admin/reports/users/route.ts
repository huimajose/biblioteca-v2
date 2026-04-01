import { NextResponse } from 'next/server';
import { listUserReports } from '@/db/crud/transactions.crud';

export async function GET() {
  try {
    const data = await listUserReports();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Erro ao gerar relatorio' }, { status: 500 });
  }
}
