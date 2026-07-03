"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { toDate } from "@/lib/conversation-window";
import { resolveMessageMediaUrl } from "@/lib/chat-utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Message } from "@/lib/types";
import { motion } from "framer-motion";
import { MessageStatusIcon } from "@/components/chat/MessageStatusIcon";
import { TextMessageContent } from "@/components/chat/messages/TextMessageContent";
import { ImageMessageContent } from "@/components/chat/messages/ImageMessageContent";
import { AudioMessageContent } from "@/components/chat/messages/AudioMessageContent";
import { DocumentMessageContent } from "@/components/chat/messages/DocumentMessageContent";
import { VideoMessageContent } from "@/components/chat/messages/VideoMessageContent";
import { StickerMessageContent } from "@/components/chat/messages/StickerMessageContent";
import { TemplateMessageContent } from "@/components/chat/messages/TemplateMessageContent";
import { QuotedMessagePreview } from "@/components/chat/messages/QuotedMessagePreview";
import { MessageReactions } from "@/components/chat/messages/MessageReactions";

interface MessageBubbleProps {
  message: Message;
  conversationId: string;
  index: number;
  pending?: boolean;
  onRetry?: (message: Message) => void;
  retrying?: boolean;
  groupedWithPrevious?: boolean;
  groupedWithNext?: boolean;
  showSenderLabel?: boolean;
  canDeleteForEveryone?: boolean;
  onDeleteForEveryone?: (message: Message) => void;
}

export function MessageBubble({
  message,
  conversationId,
  index,
  pending,
  onRetry,
  retrying,
  groupedWithPrevious = false,
  groupedWithNext = false,
  showSenderLabel = false,
  canDeleteForEveryone = false,
  onDeleteForEveryone,
}: MessageBubbleProps) {
  const isOutbound = message.direction === "outbound";
  const isFailed = message.status === "failed";
  const isSending = Boolean(pending) && !isFailed;
  const isTemplate = message.type === "template";
  const isDeleted = Boolean(message.deletedAt);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const showDeleteMenu =
    canDeleteForEveryone &&
    isOutbound &&
    !isDeleted &&
    !isSending &&
    !message.id.startsWith("pending-") &&
    Boolean(message.whatsappMessageId) &&
    Boolean(onDeleteForEveryone);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);
  const date = toDate(message.createdAt);
  const time = date ? format(date, "HH:mm", { locale: ptBR }) : "";
  const mediaUrl = resolveMessageMediaUrl({
    id: message.id,
    conversationId,
    media: message.media,
  });

  const replyMediaUrl =
    message.replyTo?.mediaStoragePath && message.replyTo.messageId
      ? resolveMessageMediaUrl({
          id: message.replyTo.messageId,
          conversationId,
          media: { storagePath: message.replyTo.mediaStoragePath },
        })
      : null;

  const displayStatus = isSending ? "accepted" : message.status;
  const canRetry =
    isFailed &&
    isOutbound &&
    message.type === "audio" &&
    Boolean(message.media?.storagePath || message.media?.url) &&
    onRetry;

  const bubbleRadius = [
    isOutbound ? "message-outbound" : "message-inbound",
    isTemplate ? "message-bubble-template" : "",
    groupedWithPrevious ? (isOutbound ? "message-bubble-grouped-out" : "message-bubble-grouped-in") : "",
    !groupedWithNext ? (isOutbound ? "message-bubble-tail-out" : "message-bubble-tail-in") : "",
    groupedWithPrevious ? "message-bubble-grouped" : "",
  ]
    .filter(Boolean)
    .join(" ");

  function renderContent() {
    if (isDeleted) {
      return (
        <p className="message-bubble-meta italic opacity-80">
          Mensagem apagada
        </p>
      );
    }
    if (message.type === "template") {
      return <TemplateMessageContent message={message} mediaUrl={mediaUrl} />;
    }
    if (message.type === "image" && mediaUrl) {
      return (
        <ImageMessageContent
          src={mediaUrl}
          caption={message.media?.caption || message.body}
        />
      );
    }
    if (message.type === "video" && mediaUrl) {
      return (
        <VideoMessageContent
          src={mediaUrl}
          caption={message.media?.caption || message.body}
        />
      );
    }
    if (message.type === "sticker" && mediaUrl) {
      return <StickerMessageContent src={mediaUrl} />;
    }
    if (message.type === "audio" && mediaUrl) {
      return <AudioMessageContent src={mediaUrl} outbound={isOutbound} />;
    }
    if (message.type === "document" && mediaUrl) {
      return (
        <DocumentMessageContent
          src={mediaUrl}
          filename={message.body}
          caption={message.media?.caption}
        />
      );
    }
    if (
      message.type === "audio" ||
      message.type === "image" ||
      message.type === "document" ||
      message.type === "video" ||
      message.type === "sticker"
    ) {
      return (
        <p className="message-bubble-meta italic">
          {message.type === "audio"
            ? "Áudio indisponível"
            : message.type === "image"
              ? "Imagem indisponível"
              : message.type === "video"
                ? "Vídeo indisponível"
                : message.type === "sticker"
                  ? "Figurinha indisponível"
                  : "Documento indisponível"}
        </p>
      );
    }
    return <TextMessageContent body={message.body} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      className={`flex flex-col ${isOutbound ? "items-end" : "items-start"}`}
    >
      {isOutbound && showSenderLabel && message.sentByName && (
        <p className="mb-0.5 px-1 text-[0.6875rem] font-medium text-app-muted">
          {message.sentByName}:
        </p>
      )}
      <div className={`group relative max-w-[75%] ${message.reactions?.length ? "mb-3" : ""}`}>
        {showDeleteMenu && (
          <div ref={menuRef} className="absolute right-1 top-1 z-10">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-full bg-black/20 p-0.5 text-white/80 opacity-0 transition-opacity hover:bg-black/30 group-hover:opacity-100"
              aria-label="Opções da mensagem"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 min-w-[12rem] rounded-xl border border-app-border bg-app-card p-1 shadow-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDeleteForEveryone?.(message);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-300 hover:bg-white/5"
                >
                  <Trash2 className="h-4 w-4" />
                  Apagar para todos
                </button>
              </div>
            )}
          </div>
        )}
        <div
          className={`relative rounded-lg leading-relaxed ${bubbleRadius} ${
            isSending ? "opacity-80" : ""
          } ${isFailed ? "ring-1 ring-red-500/40" : ""}`}
        >
          {message.replyTo && (
            <div className={isTemplate ? "px-2 pt-2" : "px-2 pt-2"}>
              <QuotedMessagePreview
                replyTo={message.replyTo}
                outbound={isOutbound}
                mediaUrl={replyMediaUrl}
              />
            </div>
          )}
          {renderContent()}
          <div
            className={`mt-1 flex flex-wrap items-center justify-end gap-1.5 message-bubble-meta ${
              isTemplate ? "px-2 pb-2" : "px-2 pb-2"
            }`}
          >
            {isSending && <span>enviando</span>}
            {isFailed && <span className="text-red-300">falhou</span>}
            {isFailed && message.statusError && (
              <span className="max-w-[180px] truncate text-red-200/90" title={message.statusError}>
                {message.statusError}
              </span>
            )}
            {time && <span>{time}</span>}
            <MessageStatusIcon status={displayStatus} outbound={isOutbound} />
          </div>
          {canRetry && (
            <button
              type="button"
              disabled={retrying}
              onClick={() => onRetry(message)}
              className="mx-2 mb-2 mt-1.5 w-[calc(100%-1rem)] rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-[0.6875rem] font-medium text-red-200 hover:bg-red-500/15 disabled:opacity-50"
            >
              {retrying ? "Reenviando..." : "Tentar novamente"}
            </button>
          )}
        </div>
        <MessageReactions reactions={message.reactions} />
      </div>
    </motion.div>
  );
}
