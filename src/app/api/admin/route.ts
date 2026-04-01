// app/api/admin/route.ts
import { NextResponse } from "next/server";
import { readUsers, updateUserRole, verifyAdmin } from "@/db/crud/users.crud";
import { clerkClient } from "@clerk/nextjs/server";

// 🔹 GET → retorna todos os usuários verificados
export async function GET() {
  try {
    const users = await readUsers();

    const clerk = await clerkClient();

    

    // Enriquecer dados com Clerk (nome, imagem)
    const enriched = await Promise.all(
      users.map(async (user: any) => {
        try {
          const clerkUser = await clerk.users.getUser(user.clerkId);


          return {
            id: user.clerkId,
            fullName: `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim(),
            email: user.primaryEmail,
            profile: clerkUser.imageUrl,
            role: user.role ?? "User",
          };
        } catch {
          return {
            id: user.clerkId,
            fullName: "Usuário não encontrado",
            email: user.primaryEmail,
            profile: null,
            role: user.role ?? "User",
          };
        }
      })
    );

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("Erro ao buscar usuários verificados:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// 🔹 POST → atualizar role (Admin / Estudante)
export async function POST(request: Request) {
  try {
    const { userId, newRole } = await request.json();
    await updateUserRole(userId, newRole);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao atualizar role:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
