export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ email: z.string().email().max(160) });

/**
 * Dispara o e-mail de redefinição de senha da Captamo (template próprio).
 * Rota pública (a tela de login usa sem sessão), por isso:
 * - nunca revela se o e-mail existe (`sent: true` mesmo para desconhecidos);
 * - `sent: false` APENAS quando o SMTP está indisponível — sinal para o
 *   cliente cair no e-mail nativo do Firebase como fallback.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
    }

    const { sendPasswordEmail } = await import("@/lib/password-email");
    const result = await sendPasswordEmail(parsed.data.email, "reset");

    return NextResponse.json({ ok: true, sent: result !== "unavailable" });
  } catch (error) {
    console.error("[auth/password-email POST]", error);
    // Falha inesperada: deixa o cliente usar o fallback nativo.
    return NextResponse.json({ ok: true, sent: false });
  }
}
