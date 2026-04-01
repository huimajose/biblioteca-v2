export const runtime = "nodejs";

import { NextResponse, NextRequest } from "next/server";
import { readBooks, updateBookFileUrl } from "@/db/crud/books.crud";
import { createClient } from "@supabase/supabase-js";
import { getRecentBooks } from "@/db/crud/books.crud";
import { getBookCover } from "@/services/bookCover.service";


// Inicializa o Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY! // ou anon key se estiver no client, mas prefira SERVICE_KEY no server
);


export async function GET(request: NextRequest){

  try {
    const { searchParams } = new URL(request.url);
    
    

if (searchParams.get("recent") === "true") {
  console.log("📚 Requisição recebida: livros recentes");

  const recentBooks = await getRecentBooks();

  const enrichedBooks = await Promise.all(
    recentBooks.map(async (book) => {
      // 🟢 Se já tem capa, não faz nada
      if (book.cover) return book;

      // 🔍 Buscar capa externa
      const cover = await getBookCover({
        isbn: book.isbn,
        title: book.title,
      });

      if (!cover?.url) return book;

      // 💾 (opcional, mas recomendado) guardar no banco
      // await updateBookCover(book.id, cover.url);

      return {
        ...book,
        cover: cover.url,
        coverSource: cover.source, // OpenLibrary | Google | etc
      };
    })
  );

  console.log("✅ Livros recentes enriquecidos:", enrichedBooks.length);

  return NextResponse.json(enrichedBooks);
}
  const page = parseInt(searchParams.get("page") || "1"); // 🔹 aqui
    const pageSize = parseInt(searchParams.get("pageSize") || "10");
    const sort = searchParams.get("sort") || "title";
    const order = searchParams.get("order") || "asc";
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category");

    console.log("📗 Categoria recebida:", category);

    const response = await readBooks(page, pageSize, sort, order, search, category);
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching books:", error);
    return NextResponse.json(
      { error: "Failed to fetch books" },
      { status: 500 }
    );
  }
} 

const getContentType = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'pdf':
      return 'application/pdf';
    case 'epub':
      return 'application/epub+zip';
    case 'mobi':
      return 'application/x-mobipocket-ebook';
    default:
      return 'application/octet-stream';
  }
};

export async function POST(request: NextRequest) {
  try {
    console.log("=== Início da requisição POST em /api/books ===");

    const body = await request.json();
    const { bookId, fileName, base64 } = body;

    console.log("Payload recebido:", bookId, fileName);

    if (!bookId || !fileName || !base64) {
      return NextResponse.json(
        { error: "Campos obrigatórios em falta (bookId, fileName, base64)" },
        { status: 400 }
      );
    }

    const normalizeFileName = (name: string) => {
      return name
        .replace(/[\s-]+/g, "_")         // Espaços e hífens → underscore
        .replace(/[^a-zA-Z0-9_.]/g, "_"); // Remove outros caracteres
    };

    const safeFileName = normalizeFileName(fileName); // Ex: "Relatorio_ISPI.pdf"
    const filePath = `${bookId}/${safeFileName}`;     // Ex: "47/Relatorio_ISPI.pdf"

    const { error: uploadError } = await supabase.storage
      .from("books")
      .upload(filePath, Buffer.from(base64, "base64"), {
        contentType: getContentType(fileName),
        upsert: true,
      });

    if (uploadError) {
      console.error("Erro ao fazer upload para o Supabase Storage:", uploadError);
      return NextResponse.json(
        { error: "Erro ao fazer upload para o Supabase Storage" },
        { status: 500 }
      );
    }

    // Salvar apenas o nome do arquivo no banco: "Relatorio_ISPI.pdf"
    await updateBookFileUrl(bookId, safeFileName);

    return NextResponse.json(
      {
        success: true,
        message: "Arquivo enviado com sucesso",
        url: `${bookId}/${safeFileName}`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erro ao processar a requisição:", error);
    return NextResponse.json(
      { error: "Erro ao processar a requisição" },
      { status: 500 }
    );
  }
}
