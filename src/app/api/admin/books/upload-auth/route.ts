import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@clerk/nextjs/server';
import ImageKit from 'imagekit';
import { getDb } from '@/app/api/_utils/db';
import { resolveActorRole } from '@/app/api/_utils/audit';
import { canAccessAdminSection } from '@/utils/roles';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /i, '');
  if (!token) return NextResponse.json({ error: 'Inicie sessão para enviar ficheiros.' }, { status: 401 });

  let userId: string;
  try {
    const session = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    userId = session.sub;
  } catch {
    return NextResponse.json({ error: 'Sessão expirada. Inicie sessão novamente.' }, { status: 401 });
  }

  try {
    const role = await resolveActorRole(getDb(), userId);
    if (!canAccessAdminSection(role, 'books')) {
      return NextResponse.json({ error: 'Sem permissão para enviar ficheiros de livros.' }, { status: 403 });
    }
    const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || process.env.NEXT_IMAGEKIT_PUBLIC_KEY || process.env.NEXT_PUBLIC_PUBLIC_KEY;
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY || process.env.PRIVATE_KEY;
    const urlEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || process.env.NEXT_IMAGEKIT_URL_ENDPOINT || process.env.NEXT_PUBLIC_URL_ENDPOINT;
    if (!publicKey || !privateKey || !urlEndpoint) {
      return NextResponse.json({ error: 'O envio de ficheiros ainda não está configurado. Contacte o administrador.' }, { status: 503 });
    }
    const imagekit = new ImageKit({ publicKey, privateKey, urlEndpoint });
    const auth = imagekit.getAuthenticationParameters(undefined, Math.floor(Date.now() / 1000) + 300);
    return NextResponse.json({ ...auth, publicKey }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[book-upload] Failed to authorize upload', error);
    return NextResponse.json({ error: 'Não foi possível preparar o envio. Tente novamente.' }, { status: 500 });
  }
}
