import { NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import * as schema from '@/db/pgSchema';
import { getDb } from '@/app/api/_utils/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();
    const genres = await db.select().from(schema.genres).orderBy(asc(schema.genres.name));
    return NextResponse.json(genres);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao carregar cursos' },
      { status: 500 }
    );
  }
}
