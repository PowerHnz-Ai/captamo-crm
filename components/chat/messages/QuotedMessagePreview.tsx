"use client";



import type { MessageReplyPreview } from "@/lib/types";



interface QuotedMessagePreviewProps {

  replyTo: MessageReplyPreview;

  outbound?: boolean;

  mediaUrl?: string | null;

}



export function QuotedMessagePreview({

  replyTo,

  outbound = false,

  mediaUrl,

}: QuotedMessagePreviewProps) {

  const quoteClass = outbound ? "chat-quote-preview-out" : "chat-quote-preview-in";



  return (

    <div className={`chat-quote-preview flex gap-2 rounded-md px-2 py-1.5 ${quoteClass}`}>

      {mediaUrl && (

        <img

          src={mediaUrl}

          alt=""

          className="h-12 w-12 shrink-0 rounded object-cover"

        />

      )}

      <div className="min-w-0 flex-1">

        {replyTo.senderLabel && (

          <p className="truncate text-[0.8125rem] font-medium text-[var(--chat-template-button)]">

            {replyTo.senderLabel}

          </p>

        )}

        <p className="line-clamp-2 text-[0.8125rem] leading-snug text-app-subtle">

          {replyTo.body}

        </p>

      </div>

    </div>

  );

}

