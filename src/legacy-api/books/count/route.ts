import { NextResponse } from 'next/server';
import { getBooksCount } from '@/db/crud/books.crud';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get('type');

    // Converte para number, ou undefined se não passar
    const type = typeParam ? parseInt(typeParam, 10) : undefined;

    if (typeParam && isNaN(type)) {
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
    }

    try {
        const count = await getBooksCount(type);
        return NextResponse.json({ count });
    } catch (error) {
        return NextResponse.json({ error: 'Erro ao contar livros' }, { status: 500 });
    }
}
export const dynamic = 'force-dynamic'; // Força a revalidação a cada requisição
