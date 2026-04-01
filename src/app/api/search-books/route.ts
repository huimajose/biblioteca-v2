// app/api/search-books/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readBooks } from "@/db/crud/books.crud";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = Number(searchParams.get("page")) || 1;
  const pageSize = Number(searchParams.get("pageSize")) || 10;
  const sortField = searchParams.get("sort") || "title";
  const sortOrder = searchParams.get("order") || "asc";
  const searchQuery = searchParams.get("q") || ""; // Adiciona suporte a pesquisa

  const result = await readBooks(page, pageSize, sortField, sortOrder, searchQuery);
  return NextResponse.json(result);
}
