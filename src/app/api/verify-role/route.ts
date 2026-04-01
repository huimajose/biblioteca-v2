import { NextResponse } from "next/server";
import { getUserRole } from "@/utils/roles";

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    console.log("🔍 Verificando role para userId:", userId); // 👈 debug

    if (!userId) {
      return NextResponse.json({ error: "userId é obrigatório" }, { status: 400 });
    }

    const role = await getUserRole(userId);
    console.log("🎯 Role encontrada:", role); // 👈 debug

    return NextResponse.json({ role });
  } catch (error: any) {
    console.error("❌ Erro no verify-role:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}
