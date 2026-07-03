import type { Contact } from "./types";
import type { CompanyScope } from "./firestore-repositories";
import { normalizePhone } from "./whatsapp/phone";

export interface AudienceSelector {
  contactListId?: string;
  contactIds?: string[];
  tags?: string[];
  leadClasses?: number[];
  originId?: string;
  originFieldFilters?: Record<string, string>;
  audienceType?: string;
}

export interface UploadPreviewRow {
  name: string;
  phone: string;
  tags?: string[];
  customFields?: Record<string, string>;
  originId?: string;
  originFields?: Record<string, string>;
}

export interface AudienceExclusionOptions {
  excludeRecentDays?: number;
  excludeCampaignId?: string;
  excludeTags?: string[];
  excludeLeadClasses?: number[];
}

export interface AudienceResolutionResult {
  contacts: Contact[];
  excludedRecentCount: number;
  excludedTagsCount: number;
  excludedClassesCount: number;
}

function matchesOriginFieldFilters(
  contact: Contact,
  filters?: Record<string, string>
): boolean {
  if (!filters || Object.keys(filters).length === 0) return true;
  const fields = contact.originFields || {};
  return Object.entries(filters).every(([key, value]) => {
    if (!value) return true;
    return fields[key] === value;
  });
}

/**
 * Resolve o público de uma campanha a partir do seletor escolhido.
 * Ordem de prioridade: lista > seleção manual (ids) > tags > classes > origem > todos com opt-in.
 * Sempre filtra contatos bloqueados, sem opt-in ou arquivados.
 */
export async function resolveCampaignAudience(
  selector: AudienceSelector,
  scope: CompanyScope
): Promise<Contact[]> {
  const { getContactsForList, getContactById, listContacts } = await import(
    "./firestore-repositories"
  );

  const eligible = (c: Contact | null | undefined): c is Contact =>
    Boolean(c && !c.blocked && c.optIn && !c.archived);

  if (selector.contactListId) {
    const contacts = await getContactsForList(selector.contactListId, scope);
    return contacts.filter(eligible);
  }

  if (selector.contactIds?.length) {
    const result: Contact[] = [];
    for (const id of selector.contactIds) {
      const c = await getContactById(id, scope);
      if (eligible(c)) result.push(c);
    }
    return result;
  }

  if (selector.tags?.length) {
    const wanted = new Set(selector.tags);
    const all = await listContacts(scope);
    return all.filter(
      (c) => eligible(c) && (c.tags || []).some((t) => wanted.has(t))
    );
  }

  if (selector.leadClasses?.length || selector.audienceType === "classes") {
    const wanted = new Set(selector.leadClasses || []);
    if (wanted.size === 0) return [];
    const all = await listContacts(scope);
    return all.filter(
      (c) => eligible(c) && c.leadClass != null && wanted.has(c.leadClass)
    );
  }

  if (selector.originId || selector.audienceType === "origin") {
    const originId = selector.originId;
    if (originId) {
      const all = await listContacts(scope, { originId });
      return all.filter(
        (c) => eligible(c) && matchesOriginFieldFilters(c, selector.originFieldFilters)
      );
    }
  }

  const all = await listContacts(scope);
  return all.filter(eligible);
}

export function resolveUploadPreviewAudience(
  rows: UploadPreviewRow[]
): { contacts: Contact[]; invalid: number } {
  const contacts: Contact[] = [];
  let invalid = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (!row.phone) {
      invalid++;
      continue;
    }
    try {
      const phone = normalizePhone(row.phone);
      contacts.push({
        id: `upload-${i}`,
        name: row.name || phone,
        phone,
        source: "campanha",
        tags: row.tags || [],
        optIn: true,
        blocked: false,
        customFields: row.customFields,
        originId: row.originId,
        originFields: row.originFields,
        createdAt: {} as Contact["createdAt"],
        updatedAt: {} as Contact["updatedAt"],
      });
    } catch {
      invalid++;
    }
  }

  return { contacts, invalid };
}

export async function countEligibleContacts(scope: CompanyScope): Promise<number> {
  const { listContacts } = await import("./firestore-repositories");
  const all = await listContacts(scope);
  return all.filter((c) => !c.blocked && c.optIn && !c.archived).length;
}

export async function countEligibleContactsByOrigin(
  originId: string,
  scope: CompanyScope,
  originFieldFilters?: Record<string, string>
): Promise<number> {
  const contacts = await resolveCampaignAudience(
    { originId, audienceType: "origin", originFieldFilters },
    scope
  );
  return contacts.length;
}

function filterContactsByTagAndClassExclusions(
  contacts: Contact[],
  options?: Pick<AudienceExclusionOptions, "excludeTags" | "excludeLeadClasses">
): { contacts: Contact[]; excludedTagsCount: number; excludedClassesCount: number } {
  const excludeTags = new Set(options?.excludeTags || []);
  const excludeClasses = new Set(options?.excludeLeadClasses || []);

  if (excludeTags.size === 0 && excludeClasses.size === 0) {
    return { contacts, excludedTagsCount: 0, excludedClassesCount: 0 };
  }

  let excludedTagsCount = 0;
  let excludedClassesCount = 0;

  const filtered = contacts.filter((c) => {
    if (excludeTags.size > 0 && (c.tags || []).some((t) => excludeTags.has(t))) {
      excludedTagsCount++;
      return false;
    }
    if (
      excludeClasses.size > 0 &&
      c.leadClass != null &&
      excludeClasses.has(c.leadClass)
    ) {
      excludedClassesCount++;
      return false;
    }
    return true;
  });

  return { contacts: filtered, excludedTagsCount, excludedClassesCount };
}

export async function resolveCampaignAudienceWithExclusions(
  selector: AudienceSelector,
  scope: CompanyScope,
  options?: AudienceExclusionOptions
): Promise<AudienceResolutionResult> {
  const contacts = await resolveCampaignAudience(selector, scope);
  const days = options?.excludeRecentDays;

  let working = contacts;
  let excludedRecentCount = 0;

  if (days && days >= 1) {
    const {
      getRecentlyTargetedContactIds,
      filterContactsByRecentExclusion,
    } = await import("./campaign-recent-exclusion");

    const excludedIds = await getRecentlyTargetedContactIds(scope, days, {
      excludeCampaignId: options?.excludeCampaignId,
    });

    const result = filterContactsByRecentExclusion(working, excludedIds);
    working = result.contacts;
    excludedRecentCount = result.excludedCount;
  }

  const tagClassResult = filterContactsByTagAndClassExclusions(working, {
    excludeTags: options?.excludeTags,
    excludeLeadClasses: options?.excludeLeadClasses,
  });

  return {
    contacts: tagClassResult.contacts,
    excludedRecentCount,
    excludedTagsCount: tagClassResult.excludedTagsCount,
    excludedClassesCount: tagClassResult.excludedClassesCount,
  };
}
