/**
 * O checklist operacional (Captamo Tasks) agora é um app independente, com
 * deploy e domínio próprios. O CRM apenas encaminha para essa URL externa.
 * Configure em NEXT_PUBLIC_TASK_CHECKLIST_URL; o fallback é o domínio padrão.
 */
export const CHECKLIST_ENTRY_PATH =
  process.env.NEXT_PUBLIC_TASK_CHECKLIST_URL?.trim() ||
  "https://tasks.captamo.com.br";
