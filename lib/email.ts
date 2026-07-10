import nodemailer, { type Transporter } from "nodemailer";

/**
 * Envio de e-mail transacional via SMTP (Hostinger). Opt-in por env:
 * SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (+ MAIL_FROM_NAME opcional).
 * Sem config, isMailConfigured() = false e os callers caem no fallback
 * (e-mail padrão do Firebase) — ninguém fica sem link de senha.
 */

export function isMailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || "465");
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST!.trim(),
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER!.trim(),
        pass: process.env.SMTP_PASS!,
      },
    });
  }
  return transporter;
}

export async function sendMail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const fromName = process.env.MAIL_FROM_NAME?.trim() || "Captamo";
  await getTransporter().sendMail({
    from: `"${fromName}" <${process.env.SMTP_USER!.trim()}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
}
