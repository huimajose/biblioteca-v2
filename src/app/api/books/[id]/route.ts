import { NextResponse } from "next/server";
import { updateBook } from "@/db/crud/books.crud";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await Promise.resolve(params);
    const bookId = parseInt(id);
    if (isNaN(bookId)) {
      return NextResponse.json(
        { error: "Invalid book ID" },
        { status: 400 }
      );
    }

    console.log("=== Início da requisição PUT em /api/books/[id] ===");
    

    const body = await request.json();

    console.log("payload recebido actualizado:", body)
    const {
      title,
      author,
      genre,
      isbn,
      totalCopies,
      availableCopies,
      cover,
      fileUrl,
      document_type,
      is_digital,
      prateleira,
      editora,
      cdu,
      anoEdicao,
      edicao,
    } = body;
    
    await updateBook(
      bookId,
      title,
      author,
      genre,
      isbn,
      totalCopies,
      availableCopies,
      cover,
      fileUrl,
      document_type,
      is_digital,
      prateleira ?? null,
      editora ?? null,
      cdu ?? null,
      anoEdicao ?? null,
      edicao ?? null
    );
    
    return NextResponse.json({ message: "Book updated successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error updating book:", error);
    return NextResponse.json(
      { error: "Failed to update book" },
      { status: 500 }
    );
  }
} 
