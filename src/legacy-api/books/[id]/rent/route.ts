/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';
import {  rentBook } from '@/db/crud/books.crud';
import { auth } from '@clerk/nextjs/server'
import { clerkClient } from '@clerk/nextjs/server';




export async function POST(
    
    request: Request,
    {params }: { params: { id: string } }
) {
    const { userId } = await auth()
    try {
        const {id} = await Promise.resolve(params);
        const bookId = parseInt(id);
    
        if (isNaN(bookId)) {
            return NextResponse.json({ error: "ID inválido" }, { status: 400 });
      }

        const clerk = await clerkClient();
       const user = await clerk.users.getUser(userId);
    const userName = user.fullName || "Usuário Desconhecido";

    
        

        if (!userId) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        const result = await rentBook(bookId, userId, userName);
return NextResponse.json(
  { success: result.success, message: result.message },
  { status: result.success ? 200 : 400 }
);

    } catch (error) {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
