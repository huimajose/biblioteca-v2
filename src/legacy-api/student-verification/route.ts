// app/api/student-verification/route.ts
import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { drizzle } from "drizzle-orm/neon-http";
import { studentVerifications } from "@/db/schema";
import { eq } from "drizzle-orm";

const db = drizzle(process.env.DATABASE_URL!);

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });

    // Busca pedidos do usuário
    const records = await db
      .select()
      .from(studentVerifications)
      .where(eq(studentVerifications.clerkId, user.id));

    const hasPending = records.some(r => r.status === "pending");

    return NextResponse.json({ hasPending, records });
  } catch (err: any) {
    console.error("Erro ao verificar status:", err);
    return NextResponse.json({ error: err.message || "Erro desconhecido" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });

    const { studentNumber } = await req.json();

    // Verifica se já existe pedido pendente
    const existing = await db
      .select()
      .from(studentVerifications)
      .where(eq(studentVerifications.clerkId, user.id));

    if (existing.some(r => r.status === "pending")) {
      return NextResponse.json({ error: "Você já possui um pedido pendente." }, { status: 400 });
    }

    // Criar registro de verificação
    const record = {
      clerkId: user.id,
      studentNumber,
      status: "pending", // pending, approved, rejected
      createdAt: new Date(),
    };

    await db.insert(studentVerifications).values(record);

    // Notificação para admin (exemplo simples)
    console.log(`Admin notification: Usuário ${user.fullName} solicitou verificação.`);

    return NextResponse.json({ message: "Número enviado para verificação." });
  } catch (err: any) {
    console.error("Erro ao criar verificação:", err);
    return NextResponse.json({ error: err.message || "Erro desconhecido" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });

    // Opcional: permite que o usuário cancele pedido pendente
    const deleted = await db
      .delete(studentVerifications)
      .where(
        eq(studentVerifications.clerkId, user.id)
      );

    return NextResponse.json({ message: "Pedidos removidos com sucesso.", deleted });
  } catch (err: any) {
    console.error("Erro ao deletar verificação:", err);
    return NextResponse.json({ error: err.message || "Erro desconhecido" }, { status: 500 });
  }
}
