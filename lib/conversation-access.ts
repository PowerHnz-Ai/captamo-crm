import type { AuthContext } from "./auth-server";
import type { Conversation } from "./types";
import { getEffectiveRole } from "./roles";

/** Membro pode ver/editar conversa atribuída a si ou na fila (sem responsável). */
export function memberCanAccessConversation(
  auth: AuthContext,
  conversation: Conversation
): boolean {
  if (getEffectiveRole(auth) !== "member") return true;
  if (!conversation.assignedTo) return true;
  return conversation.assignedTo === auth.uid;
}

export function memberCanModifyConversation(
  auth: AuthContext,
  conversation: Conversation
): boolean {
  if (getEffectiveRole(auth) !== "member") return true;
  if (!conversation.assignedTo) return false;
  return conversation.assignedTo === auth.uid;
}
