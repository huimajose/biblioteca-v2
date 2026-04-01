// app/api/user/count/route.ts
import { NextResponse } from 'next/server';
import { getUserCount } from "@/db/crud/users.crud";
import { getCountAllUsers } from "@/db/crud/users.crud";
import { NextRequest } from 'next/server';



// API handler
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl;
        const method = searchParams.get("method") || "db";

        let count = 0;

        if (method === "students") {
            count = await getUserCount();
        } else {
            count = await getCountAllUsers();
            
        }

        return NextResponse.json({ count });
    } catch (error) {
        console.error("Erro ao buscar contagem de usuários:", error);
        return NextResponse.json(
            { error: "Erro ao buscar contagem de usuários" },
            { status: 500 }
        );
    }
  }
