import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route"; // ← Update path if needed
import { readBooks } from "@/db/crud/books.crud";
import { NextRequest } from "next/server";

vi.mock("@/db/crud/books.crud", () => ({
  readBooks: vi.fn(),
}));

describe("GET /api/books", () => {
  const mockReadBooks = readBooks as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockRequest = (url: string) => new NextRequest(new URL(url, "http://localhost"));

  it("should call readBooks with default pagination if no params are given", async () => {
    mockReadBooks.mockResolvedValueOnce({ books: [], total: 0 });

    const request = createMockRequest("/api/books");
    const response = await GET(request);
    const data = await response.json();

    expect(mockReadBooks).toHaveBeenCalledWith(1, 10);
    expect(data).toEqual({ books: [], total: 0 });
  });

  it("should call readBooks with provided page and pageSize", async () => {
    mockReadBooks.mockResolvedValueOnce({ books: ["Book1", "Book2"], total: 2 });

    const request = createMockRequest("/api/books?page=2&pageSize=5");
    const response = await GET(request);
    const data = await response.json();

    expect(mockReadBooks).toHaveBeenCalledWith(2, 5);
    expect(data).toEqual({ books: ["Book1", "Book2"], total: 2 });
  });
});
