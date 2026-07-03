import { getWhatsAppConfig } from "./companies";
import { getDailyStats } from "./stats-daily";
import { getWhatsAppProvider } from "./whatsapp";

const META_TIER_LIMITS: Record<number, number> = {
  0: 250,
  1: 1000,
  2: 10000,
  3: 100000,
  4: 1000000,
};

export interface MessagingLimitStatus {
  tier: number;
  dailyLimit: number;
  dailyCap: number;
  sentToday: number;
  templatesSentToday: number;
  remaining: number;
  canSend: boolean;
  provider: string;
}

export async function getMessagingLimitStatus(
  companyId: string
): Promise<MessagingLimitStatus> {
  const config = await getWhatsAppConfig(companyId);
  const provider = await getWhatsAppProvider(companyId);

  let tier = config.messagingLimitTier ?? 1;
  let dailyLimit = META_TIER_LIMITS[tier] ?? 1000;

  if (provider.getMessagingLimit) {
    try {
      const info = await provider.getMessagingLimit();
      tier = info.tier;
      dailyLimit = info.dailyLimit;
    } catch {
      // fallback to config
    }
  }

  const dailyCap = config.dailyCap ?? dailyLimit;
  const effectiveLimit = Math.min(dailyLimit, dailyCap);

  const stats = await getDailyStats(companyId);
  const sentToday =
    (stats?.messagesSent || 0) + (stats?.templatesSent || 0);
  const templatesSentToday = stats?.templatesSent || 0;
  const remaining = Math.max(0, effectiveLimit - sentToday);

  return {
    tier,
    dailyLimit,
    dailyCap: effectiveLimit,
    sentToday,
    templatesSentToday,
    remaining,
    canSend: remaining > 0,
    provider: config.provider,
  };
}

export async function canSendMessages(
  companyId: string,
  count = 1
): Promise<{ allowed: boolean; reason?: string; status: MessagingLimitStatus }> {
  const status = await getMessagingLimitStatus(companyId);
  if (status.remaining < count) {
    return {
      allowed: false,
      reason: `Limite diário atingido (${status.sentToday}/${status.dailyCap}).`,
      status,
    };
  }
  return { allowed: true, status };
}
