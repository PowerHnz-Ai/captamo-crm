"use client";

import type { Message } from "@/lib/types";
import { ImageMessageContent } from "@/components/chat/messages/ImageMessageContent";
import { TextMessageContent } from "@/components/chat/messages/TextMessageContent";
import { TemplateButtons } from "@/components/chat/messages/TemplateButtons";

interface TemplateMessageContentProps {
  message: Message;
  mediaUrl?: string | null;
}

export function TemplateMessageContent({ message, mediaUrl }: TemplateMessageContentProps) {
  const text =
    message.templateRenderedBody ||
    (message.body.startsWith("Template:")
      ? message.body
      : message.body);

  return (
    <div className="overflow-hidden">
      {mediaUrl && (
        <ImageMessageContent
          src={mediaUrl}
          alt="Cabeçalho do template"
          className="rounded-none"
        />
      )}
      <div className="px-2.5 py-2">
        <TextMessageContent body={text} />
        {message.templateFooter && (
          <p className="mt-1.5 text-[0.6875rem] leading-snug text-app-muted">
            {message.templateFooter}
          </p>
        )}
      </div>
      <TemplateButtons buttons={message.templateButtons} />
    </div>
  );
}
