import { NextResponse } from 'next/server';
import { db } from '@/db';
import * as schema from '@/db/schema';

export async function GET() {
  try {
    const books = db.select({ id: schema.books.id }).from(schema.books).all().length;
    const users = db.select({ id: schema.users.clerkId }).from(schema.users).all().length;
    const txs = db.select({ status: schema.transactions.status }).from(schema.transactions).all();
    const borrows = txs.filter((t: any) => t.status === 'borrowed').length;
    const pending = txs.filter((t: any) => t.status === 'pending').length;

    return NextResponse.json({ books, users, borrows, pending });
  } catch (err) {
    return NextResponse.json({ error: 'Erro ao carregar estatisticas' }, { status: 500 });
  }
}
