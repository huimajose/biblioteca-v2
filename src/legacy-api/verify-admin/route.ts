import { getUserRole } from "@/utils/roles";
import { NextResponse } from "next/server";


export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "userId é obrigatório" }, { status: 400 });
    }

    const role = await getUserRole(userId);

    return NextResponse.json({ role });
  } catch (error: any) {
    console.error("Erro no verify-role:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}
