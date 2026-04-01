import { NextRequest, NextResponse } from "next/server";
import { readPhysicalBooks } from "@/db/crud/books.crud";


export async function GET(req: NextRequest, context: { params: { id: string } }) {
  try {
    const { id } = context.params;
    const bookId = parseInt(id);

    if (isNaN(bookId)) {
      return NextResponse.json({ error: "ID do livro invalido" }, { status: 400 });
    }

    const physicalBooks = await readPhysicalBooks(bookId);
    return NextResponse.json(physicalBooks);
  } catch (error) {
    console.error("Ocorreuu um ero ao pegar os livros fisicos:", error);
    return NextResponse.json({ error: "Ocorreuu um ero ao pegar os livros fisicos" }, { status: 500 });
  }
}
