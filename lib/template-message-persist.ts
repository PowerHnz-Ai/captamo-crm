import { renderTemplateBody } from "./campaign-params";
import type { CompanyScope } from "./firestore-repositories";
import { getMediaSignedUrl } from "./media-storage";
import { getTemplateByName } from "./template-repositories";
import type { MessageMedia } from "./types";
import type { TemplateButton } from "./types";

export interface BuildTemplateMessageInput {
  templateName: string;
  parameters?: string[];
  headerImageStoragePath?: string;
}

export interface TemplateMessagePayload {
  body: string;
  templateName: string;
  templateParameters?: string[];
  templateRenderedBody?: string;
  templateFooter?: string;
  templateButtons?: TemplateButton[];
  media?: MessageMedia;
}

function previewBody(text: string): string {
  const firstLine = text.split("\n")[0]?.trim() || text;
  return firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine;
}

export async function buildTemplateMessagePayload(
  scope: CompanyScope,
  input: BuildTemplateMessageInput
): Promise<TemplateMessagePayload> {
  const parameters = input.parameters ?? [];
  const template = await getTemplateByName(input.templateName, scope);

  let templateRenderedBody: string | undefined;
  let templateFooter: string | undefined;
  let media: MessageMedia | undefined;

  if (template) {
    templateRenderedBody = renderTemplateBody(template.body, parameters);
    templateFooter = template.footer;

    const headerPath =
      input.headerImageStoragePath ||
      (template.header?.type === "IMAGE" ? template.header.storagePath : undefined);

    if (headerPath) {
      media = {
        storagePath: headerPath,
        mimeType: "image/jpeg",
      };
      try {
        media.url = await getMediaSignedUrl(headerPath);
      } catch {
        // storagePath is enough for the media proxy
      }
    }
  }

  const fallbackBody = `Template: ${input.templateName}${
    parameters.length ? ` — ${parameters.join(", ")}` : ""
  }`;
  const displayText = templateRenderedBody || fallbackBody;

  return {
    body: previewBody(displayText),
    templateName: input.templateName,
    templateParameters: parameters.length ? parameters : undefined,
    templateRenderedBody,
    templateFooter,
    templateButtons: template?.buttons,
    media,
  };
}
