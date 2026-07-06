"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Trash2, Reply, SmilePlus, StickyNote } from "lucide-react";
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

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

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
  onReply?: (message: Message) => void;
  onReact?: (message: Message, emoji: string) => void;
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
  onReply,
  onReact,
}: MessageBubbleProps) {
  const isOutbound = message.direction === "outbound";
  const isFailed = message.status === "failed";
  const isSending = Boolean(pending) && !isFailed;
  const isTemplate = message.type === "template";
  const isDeleted = Boolean(message.deletedAt);
  const isNote = message.type === "note";
  const [menuOpen, setMenuOpen] = useState(false);
  const [emojiRowOpen, setEmojiRowOpen] = useState(false);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(
    null
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const canDelete =
    canDeleteForEveryone &&
    isOutbound &&
    !isDeleted &&
    !isSending &&
    !message.id.startsWith("pending-") &&
    Boolean(message.whatsappMessageId) &&
    Boolean(onDeleteForEveryone);
  const canReply =
    Boolean(onReply) && !isDeleted && !isSending && !message.id.startsWith("pending-");
  const canReact =
    Boolean(onReact) &&
    !isDeleted &&
    !isSending &&
    Boolean(message.whatsappMessageId);
  const showDeleteMenu = !isNote && (canDelete || canReply || canReact);

  // Menu portalizado para escapar do overflow do painel de chat (mesmo padrão
  // de ConversationActionsMenu). Clamp horizontal para não sair da viewport e
  // flip vertical perto do rodapé.
  const MENU_PANEL_WIDTH = 224;
  const MENU_PANEL_MAX_HEIGHT = 190;

  function updateMenuPosition() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    let left = isOutbound ? rect.right - MENU_PANEL_WIDTH : rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - MENU_PANEL_WIDTH - 8));
    let top = rect.bottom + 4;
    if (top + MENU_PANEL_MAX_HEIGHT > window.innerHeight - 8) {
      top = Math.max(8, rect.top - 4 - MENU_PANEL_MAX_HEIGHT);
    }
    setMenuCoords({ top, left });
  }

  useEffect(() => {
    if (!menuOpen) return;
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setMenuOpen(false);
      setEmojiRowOpen(false);
    }
    function onScroll(e: Event) {
      if (e.target instanceof Node && panelRef.current?.contains(e.target)) return;
      updateMenuPosition();
    }
    function onResize() {
      updateMenuPosition();
    }
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Nota interna: bloco âmbar centralizado, nunca visível ao contato.
  if (isNote) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.02 }}
        className="flex justify-center"
      >
        <div className="max-w-[80%] rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <p className="mb-0.5 flex items-center gap-1.5 text-[0.6875rem] font-medium text-amber-300">
            <StickyNote className="h-3 w-3" />
            Nota interna{message.sentByName ? ` — ${message.sentByName}` : ""}
          </p>
          <p className="whitespace-pre-wrap break-words text-sm text-app-text/90">
            {message.body}
          </p>
          {time && (
            <p className="mt-1 text-right text-[0.625rem] text-amber-300/60">{time}</p>
          )}
        </div>
      </motion.div>
    );
  }

  const displayStatus = isSending ? "accepted" : message.status;
  const canRetry =
    isFailed &&
    isOutbound &&
    Boolean(onRetry) &&
    (message.type === "text"
      ? Boolean(message.body)
      : message.type === "audio" &&
        Boolean(message.media?.storagePath || message.media?.url));

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
          <div className="absolute right-1 top-1 z-10">
            <button
              ref={triggerRef}
              type="button"
              onClick={() => {
                if (menuOpen) {
                  setMenuOpen(false);
                  setEmojiRowOpen(false);
                } else {
                  updateMenuPosition();
                  setMenuOpen(true);
                }
              }}
              className="rounded-full bg-black/20 p-0.5 text-white/80 opacity-0 transition-opacity hover:bg-black/30 group-hover:opacity-100"
              aria-label="Opções da mensagem"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            {typeof document !== "undefined" && menuOpen && menuCoords
              ? createPortal(
                  <div
                    ref={panelRef}
                    className="fixed z-[200] w-56 rounded-xl border border-app-border bg-app-card p-1 shadow-2xl"
                    style={{ top: menuCoords.top, left: menuCoords.left }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {canReply && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onReply?.(message);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5"
                      >
                        <Reply className="h-4 w-4" />
                        Responder
                      </button>
                    )}
                    {canReact && !emojiRowOpen && (
                      <button
                        type="button"
                        onClick={() => setEmojiRowOpen(true)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5"
                      >
                        <SmilePlus className="h-4 w-4" />
                        Reagir
                      </button>
                    )}
                    {canReact && emojiRowOpen && (
                      <div className="flex gap-1 px-2 py-1.5">
                        {REACTION_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              setMenuOpen(false);
                              setEmojiRowOpen(false);
                              onReact?.(message, emoji);
                            }}
                            className="rounded-lg p-1 text-lg transition-transform hover:scale-125 hover:bg-white/5"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                    {canDelete && (
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
                    )}
                  </div>,
                  document.body
                )
              : null}
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
              onClick={() => onRetry?.(message)}
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
