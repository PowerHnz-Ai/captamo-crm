import type { CompanyScope } from "./firestore-repositories";

/**
 * Ao finalizar campanha: contatos que receberam e não responderam viram classe 4,
 * somente se ainda não tiverem leadClass definido.
 */
export async function applyAutoClass4ForFinishedCampaign(
  campaignId: string,
  scope: CompanyScope
): Promise<{ updated: number; skipped: number }> {
  const { getSql } = await import("./db");
  const { getContactById, updateContact, findConversationByPhone } = await import(
    "./firestore-repositories"
  );

  const jobs = await getSql().campaignJob.findMany({
    where: { campaignId, status: "sent" },
    select: { contactId: true, phone: true, createdAt: true, updatedAt: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const job of jobs) {
    if (!job.contactId) {
      skipped++;
      continue;
    }

    const contact = await getContactById(job.contactId, scope);
    if (!contact) {
      skipped++;
      continue;
    }

    if (contact.leadClass != null) {
      skipped++;
      continue;
    }

    const sentMs = (job.updatedAt ?? job.createdAt).getTime();
    const conversation = await findConversationByPhone(job.phone, scope);
    const lastInboundMs = conversation?.lastInboundAt ?? 0;
    const responded = lastInboundMs > sentMs;

    if (responded) {
      skipped++;
      continue;
    }

    await updateContact(job.contactId, { leadClass: 4 });
    updated++;
  }

  return { updated, skipped };
}
