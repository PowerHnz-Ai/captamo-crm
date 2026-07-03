import type { CampaignJob } from "./types";
import type { CompanyScope } from "./firestore-repositories";

/**
 * Ao finalizar campanha: contatos que receberam e não responderam viram classe 4,
 * somente se ainda não tiverem leadClass definido.
 */
export async function applyAutoClass4ForFinishedCampaign(
  campaignId: string,
  scope: CompanyScope
): Promise<{ updated: number; skipped: number }> {
  const { getDb } = await import("./firebase-admin");
  const { getContactById, updateContact, findConversationByPhone } = await import(
    "./firestore-repositories"
  );

  const jobsSnap = await getDb()
    .collection("campaigns")
    .doc(campaignId)
    .collection("jobs")
    .where("status", "==", "sent")
    .get();

  let updated = 0;
  let skipped = 0;

  for (const doc of jobsSnap.docs) {
    const job = doc.data() as CampaignJob;
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

    const sentMs = job.updatedAt?.toMillis?.() ?? job.createdAt?.toMillis?.() ?? 0;
    const conversation = await findConversationByPhone(job.phone, scope);
    const lastInboundMs = conversation?.lastInboundAt?.toMillis?.() ?? 0;
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
