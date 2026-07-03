/** Funções puras de exibição de usuário — seguras para componentes client. */

import { firstNameFromFullName } from "./chat-utils";

export function userDisplayName(user: {
  name?: string | null;
  email?: string | null;
  uid?: string;
}): string {
  return user.name?.trim() || user.email?.trim() || user.uid || "Usuário";
}

/** Nome curto para assinatura no WhatsApp e rótulo no chat. */
export function userChatSignatureName(user: {
  username?: string | null;
  name?: string | null;
  email?: string | null;
  uid?: string;
}): string {
  if (user.username?.trim()) return user.username.trim();
  const first = firstNameFromFullName(user.name || undefined);
  if (first) return first;
  return user.email?.trim() || user.uid || "Atendente";
}

/** Prefixo WhatsApp (negrito) para identificar o atendente na mensagem do contato. */
export function applySenderNameToOutboundBody(
  body: string,
  senderName: string
): string {
  const trimmed = body.trim();
  if (!trimmed) return trimmed;
  const prefix = `*${senderName}:*`;
  if (trimmed.startsWith(prefix)) return trimmed;
  return `${prefix}\n${trimmed}`;
}
