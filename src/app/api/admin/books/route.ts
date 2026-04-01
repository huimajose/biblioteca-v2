import { NextRequest, NextResponse } from "next/server";
import { readBooks } from "@/db/crud/books.crud";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = Number(searchParams.get("page")) || 1;
  const pageSize = Number(searchParams.get("pageSize")) || 10;

  const result = await readBooks(page, pageSize);
  return NextResponse.json(result);
} 


