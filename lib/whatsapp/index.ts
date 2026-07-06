import { getWhatsAppConfig } from "../companies";
import { EvolutionProvider } from "./evolution-provider";
import { MetaCloudProvider } from "./meta-cloud-provider";
import { WasenderProvider } from "./wasender-provider";
import type { WhatsAppConfig, WhatsAppProvider } from "./types";

export function createWhatsAppProvider(config: WhatsAppConfig): WhatsAppProvider {
  switch (config.provider) {
    case "wasender":
      return new WasenderProvider(config);
    case "evolution":
      return new EvolutionProvider(config);
    case "meta_cloud":
    default:
      return new MetaCloudProvider(config);
  }
}

export async function getWhatsAppProvider(
  companyId: string,
  connectionId?: string
): Promise<WhatsAppProvider> {
  if (connectionId) {
    const { getConnection, resolveConnectionConfig } = await import(
      "../connections"
    );
    const connection = await getConnection(companyId, connectionId);
    if (connection) {
      return createWhatsAppProvider(await resolveConnectionConfig(connection));
    }
  }
  const config = await getWhatsAppConfig(companyId);
  return createWhatsAppProvider(config);
}

export {
  WhatsAppProviderError,
  WhatsAppNotConfiguredError,
  type NormalizedWebhookEvent,
  type WhatsAppConfig,
  type WhatsAppProvider,
  type SendTemplateParams,
  type SendTextParams,
} from "./types";
export * from "./phone";
export { MetaCloudProvider } from "./meta-cloud-provider";
export { WasenderProvider } from "./wasender-provider";
export { EvolutionProvider } from "./evolution-provider";
