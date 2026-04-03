import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  if (!url) {
    return NextResponse.json({ ok: false, error: 'URL obrigatoria' }, { status: 400 });
  }
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return NextResponse.json({ ok: response.ok, status: response.status });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Falha ao validar' });
  }
}
