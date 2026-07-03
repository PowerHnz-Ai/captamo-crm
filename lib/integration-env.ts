export interface IntegrationEnvStatus {
  metaToken: boolean;
  metaPhoneNumberId: boolean;
  whatsappVerifyToken: boolean;
  crmDefaultCompanyId: boolean;
  firebaseAdmin: boolean;
  appUrl: string;
}

export function getIntegrationEnvStatus(): IntegrationEnvStatus {
  return {
    metaToken: Boolean(process.env.META_WHATSAPP_TOKEN?.trim()),
    metaPhoneNumberId: Boolean(process.env.META_PHONE_NUMBER_ID?.trim()),
    whatsappVerifyToken: Boolean(process.env.WHATSAPP_VERIFY_TOKEN?.trim()),
    crmDefaultCompanyId: Boolean(process.env.CRM_DEFAULT_COMPANY_ID?.trim()),
    firebaseAdmin: Boolean(
      process.env.FIREBASE_PROJECT_ID?.trim() &&
        process.env.FIREBASE_CLIENT_EMAIL?.trim() &&
        process.env.FIREBASE_PRIVATE_KEY?.trim()
    ),
    appUrl: process.env.APP_URL?.trim() || "http://localhost:3000",
  };
}

export function isProductionWebhookUrl(appUrl: string): boolean {
  try {
    const url = new URL(appUrl);
    return url.protocol === "https:" && !url.hostname.includes("localhost");
  } catch {
    return false;
  }
}

export interface WebhookReachabilityResult {
  ok: boolean;
  status?: number;
  message: string;
  bodyPreview?: string;
}

/** Simula o GET de verificação que a Meta faz ao salvar o webhook. */
export async function checkWebhookUrlReachability(
  callbackUrl: string,
  verifyToken: string
): Promise<WebhookReachabilityResult> {
  const challenge = "ultra_webhook_probe";
  const url = new URL(callbackUrl);
  url.searchParams.set("hub.mode", "subscribe");
  url.searchParams.set("hub.verify_token", verifyToken);
  url.searchParams.set("hub.challenge", challenge);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
    });
    const text = await response.text();

    if (response.ok && text.trim() === challenge) {
      return {
        ok: true,
        status: response.status,
        message: "A URL responde corretamente ao verify da Meta.",
      };
    }

    const isHtml =
      text.trimStart().startsWith("<!") ||
      text.toLowerCase().includes("<html") ||
      text.includes("Task Checklist");

    if (isHtml) {
      return {
        ok: false,
        status: response.status,
        bodyPreview: text.slice(0, 100),
        message:
          "Esta URL retorna uma página HTML (ex.: Task Checklist), não o Ultra API CRM. Faça deploy do CRM nesse domínio ou use outra URL (subdomínio ou ngrok).",
      };
    }

    return {
      ok: false,
      status: response.status,
      bodyPreview: text.slice(0, 120),
      message:
        response.status === 403
          ? "A URL respondeu 403 — o WHATSAPP_VERIFY_TOKEN em produção provavelmente não confere com o da Meta."
          : `Resposta inesperada (HTTP ${response.status}). Confira deploy e variáveis em produção.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro de rede";
    return {
      ok: false,
      message: `Não foi possível acessar a URL do webhook: ${message}`,
    };
  }
}
