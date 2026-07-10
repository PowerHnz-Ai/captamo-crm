import { getAdminAuth } from "./firebase-admin";
import { isMailConfigured, sendMail } from "./email";

export type PasswordEmailKind = "welcome" | "reset";

/**
 * Resultado do envio:
 * - "sent"           — e-mail da Captamo entregue ao SMTP.
 * - "skipped_unknown"— e-mail não cadastrado (caller deve FINGIR sucesso —
 *                      anti-enumeração de contas).
 * - "unavailable"    — SMTP não configurado ou falhou (caller usa o fallback
 *                      nativo do Firebase).
 */
export type PasswordEmailResult = "sent" | "skipped_unknown" | "unavailable";

/**
 * E-mails próprios da Captamo para (re)definição de senha, em português e com
 * a identidade visual — substituem o template padrão do Firebase (inglês,
 * remetente firebaseapp.com, caía em spam). O link continua sendo o oobCode
 * oficial do Firebase (generatePasswordResetLink).
 */
export async function sendPasswordEmail(
  email: string,
  kind: PasswordEmailKind,
  opts?: { name?: string }
): Promise<PasswordEmailResult> {
  if (!isMailConfigured()) return "unavailable";

  const appUrl = process.env.APP_URL?.trim() || "https://app.captamo.com.br";

  let link: string;
  try {
    const generated = await getAdminAuth().generatePasswordResetLink(email, {
      url: `${appUrl}/login`,
    });
    // Troca a página branca hospedada pelo Firebase pela NOSSA tela de
    // definição de senha (identidade Captamo) — o oobCode é o mesmo.
    const oobCode = new URL(generated).searchParams.get("oobCode");
    link = oobCode
      ? `${appUrl}/auth/action?mode=resetPassword&oobCode=${encodeURIComponent(oobCode)}`
      : `${generated}&lang=pt`;
  } catch (error) {
    // Tipicamente auth/user-not-found — não revelar existência ao usuário.
    console.warn("[password-email] link não gerado (e-mail desconhecido?):", error);
    return "skipped_unknown";
  }

  const firstName = opts?.name?.trim().split(/\s+/)[0] || "";
  const greeting = firstName ? `Olá, ${firstName}!` : "Olá!";

  const { subject, title, intro, button } =
    kind === "welcome"
      ? {
          subject: "Bem-vindo(a) ao Captamo — defina sua senha",
          title: "Sua conta foi criada 🎉",
          intro:
            "Você foi cadastrado(a) no <strong>Captamo</strong>, o CRM de WhatsApp da sua clínica. Para começar, defina a sua senha de acesso:",
          button: "Definir minha senha",
        }
      : {
          subject: "Redefinição de senha — Captamo",
          title: "Redefinir sua senha",
          intro:
            "Recebemos um pedido para redefinir a senha da sua conta no <strong>Captamo</strong>. Clique no botão abaixo para criar uma nova senha:",
          button: "Redefinir senha",
        };

  const html = buildEmailHtml({ greeting, title, intro, button, link, appUrl, kind });
  const text = [
    greeting,
    "",
    intro.replace(/<[^>]+>/g, ""),
    "",
    link,
    "",
    kind === "reset"
      ? "Se você não pediu a redefinição, ignore este e-mail — sua senha continua a mesma."
      : "Depois de definir a senha, acesse o sistema em " + appUrl,
    "",
    "Equipe Captamo",
  ].join("\n");

  try {
    await sendMail({ to: email, subject, html, text });
    return "sent";
  } catch (error) {
    console.error("[password-email] falha no envio SMTP:", error);
    return "unavailable";
  }
}

function buildEmailHtml(input: {
  greeting: string;
  title: string;
  intro: string;
  button: string;
  link: string;
  appUrl: string;
  kind: PasswordEmailKind;
}): string {
  const note =
    input.kind === "reset"
      ? "Se você não pediu a redefinição, pode ignorar este e-mail — sua senha continua a mesma."
      : "Se o link expirar, use a opção “Esqueci minha senha” na tela de login.";

  return `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background-color:#f6f7f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f7f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
        <tr>
          <td style="height:6px;background:linear-gradient(90deg,#2e9ee5 0%,#8fa9a0 52%,#d9c07e 100%);background-color:#2e9ee5;font-size:0;line-height:0;">&nbsp;</td>
        </tr>
        <tr>
          <td style="padding:32px 32px 8px 32px;" align="center">
            <span style="font-size:28px;font-weight:900;letter-spacing:-0.5px;color:#2e9ee5;">capta</span><span style="font-size:28px;font-weight:900;letter-spacing:-0.5px;color:#d9c07e;">mo</span>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 32px 0 32px;">
            <h1 style="margin:0 0 12px 0;font-size:20px;color:#18181b;">${input.title}</h1>
            <p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#52525b;">${input.greeting}</p>
            <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#52525b;">${input.intro}</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 32px;">
            <a href="${input.link}" style="display:inline-block;background-color:#2e9ee5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 32px;border-radius:12px;">${input.button}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 8px 32px;">
            <p style="margin:0 0 8px 0;font-size:12px;line-height:1.6;color:#71717a;">Se o botão não funcionar, copie e cole este endereço no navegador:</p>
            <p style="margin:0 0 16px 0;font-size:12px;line-height:1.5;color:#2e9ee5;word-break:break-all;">${input.link}</p>
            <p style="margin:0;font-size:12px;line-height:1.6;color:#71717a;">${note}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 28px 32px;border-top:1px solid #f0f0f2;">
            <p style="margin:16px 0 0 0;font-size:12px;color:#a1a1aa;">Equipe Captamo · <a href="${input.appUrl}" style="color:#2e9ee5;text-decoration:none;">app.captamo.com.br</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
