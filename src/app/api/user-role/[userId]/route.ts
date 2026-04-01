// app/api/user-role/[userId]/route.ts
import { NextResponse } from "next/server";
import { isStudent } from "@/utils/scoreHelper";

export async function GET(request: Request, { params }: { params: { userId: string } }) {
  const { userId } = params;
  try {
    const student = await isStudent(userId);
    return NextResponse.json({ isStudent: student });
  } catch (err) {
    return NextResponse.json({ error: "Erro ao verificar role" }, { status: 500 });
  }
}
