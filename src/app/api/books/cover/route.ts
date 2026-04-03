import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isbn = searchParams.get('isbn');
  if (!isbn) {
    return NextResponse.json({ error: 'ISBN obrigatorio' }, { status: 400 });
  }
  const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
  return NextResponse.json({ url });
}
