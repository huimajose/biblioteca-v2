import { NextResponse } from "next/server";
import { rejectTransaction } from "@/app/admin/book-requests/server"; // Reusa a função do servidor

export async function POST(req: Request) {
  try {
    const { tid, userId } = await req.json();
    const adminId = req.headers.get('x-admin-id') || req.headers.get('x-user-id') || undefined;

    if (!tid || !userId) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const result = await rejectTransaction(tid, userId, adminId);

    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: result.error });
    }
  } catch (err: any) {
    console.error("Erro ao rejeitar transação:", err);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
