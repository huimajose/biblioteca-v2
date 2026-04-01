import { NextResponse } from "next/server";
import sendMail from "@/lib/mail"; // ou caminho correto do teu mail.ts

export async function POST(request: Request) {
  try {
    const { name, email, message } = await request.json();

    if (!name || !email || !message) {
      return NextResponse.json(
        { success: false, error: "Todos os campos são obrigatórios" },
        { status: 400 }
      );
    }

    console.log("📩 Nova mensagem recebida:", { name, email, message });

    // Conteúdo do email em HTML
    const content = `
      <h2>Nova mensagem do formulário de contacto</h2>
      <p><strong>Nome:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Mensagem:</strong><br/>${message}</p>
    `;

    // envia email para o destinatário (biblioteca)
    await sendMail(process.env.CONTACT_RECEIVERR || "sti@ispi.edu.ao", content);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Erro ao enviar email:", err);
    return NextResponse.json(
      { success: false, error: "Erro ao enviar email" },
      { status: 500 }
    );
  }
}
