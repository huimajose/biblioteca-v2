import { NextResponse } from 'next/server';
import { readUsers } from '@/db/crud/users.crud';

export async function GET() {
  try {
    const users = await readUsers();
    return NextResponse.json(users);
  } catch (err) {
    return NextResponse.json({ error: 'Erro ao carregar utilizadores' }, { status: 500 });
  }
}
