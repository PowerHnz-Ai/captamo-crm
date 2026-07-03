"use client";

import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toDate } from "@/lib/conversation-window";
import type { Message } from "@/lib/types";
import { MessageBubble } from "@/components/chat/MessageBubble";

interface MessageListProps {
  messages: Message[];
  conversationId: string;
  onRetry?: (message: Message) => void;
  retryingMessageId?: string | null;
  canDeleteForEveryone?: boolean;
  onDeleteForEveryone?: (message: Message) => void;
  hasMoreOlder?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
}

function dateLabel(date: Date): string {
  if (isToday(date)) return "Hoje";
  if (isYesterday(date)) return "Ontem";
  return format(date, "d 'de' MMMM yyyy", { locale: ptBR });
}

function groupMessagesByDate(messages: Message[]): Array<{ label: string; items: Message[] }> {
  const groups: Array<{ label: string; items: Message[] }> = [];

  for (const message of messages) {
    const date = toDate(message.createdAt);
    const label = date ? dateLabel(date) : "Sem data";
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(message);
    } else {
      groups.push({ label, items: [message] });
    }
  }

  return groups;
}

export function MessageList({
  messages,
  conversationId,
  onRetry,
  retryingMessageId,
  canDeleteForEveryone,
  onDeleteForEveryone,
  hasMoreOlder,
  loadingOlder,
  onLoadOlder,
}: MessageListProps) {
  const groups = groupMessagesByDate(messages);

  return (
    <div className="space-y-3">
      {(hasMoreOlder || loadingOlder) && (
        <div className="flex justify-center pb-1">
          <button
            type="button"
            onClick={onLoadOlder}
            disabled={loadingOlder || !hasMoreOlder}
            className="rounded-full border border-app-border bg-app-card/80 px-4 py-1.5 text-xs font-medium text-app-subtle transition-colors hover:bg-white/5 hover:text-app-text disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingOlder ? "Carregando..." : "Carregar mensagens anteriores"}
          </button>
        </div>
      )}

      {groups.map((group) => (
        <div key={group.label}>
          <div className="mb-3 flex justify-center">
            <span className="chat-date-separator">{group.label}</span>
          </div>
          <div className="space-y-0.5">
            {group.items.map((message, index) => {
              const prev = index > 0 ? group.items[index - 1] : null;
              const next = index < group.items.length - 1 ? group.items[index + 1] : null;
              const sameDirAsPrev = prev?.direction === message.direction;
              const sameDirAsNext = next?.direction === message.direction;
              const sameSenderAsPrev =
                prev?.direction === "outbound" &&
                message.direction === "outbound" &&
                prev?.sentByUid &&
                message.sentByUid &&
                prev.sentByUid === message.sentByUid;
              const showSenderLabel =
                message.direction === "outbound" &&
                Boolean(message.sentByName) &&
                !sameSenderAsPrev;
              const isPending =
                message.id.startsWith("pending-") && message.status !== "failed";
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  conversationId={conversationId}
                  index={index}
                  pending={isPending}
                  onRetry={onRetry}
                  retrying={retryingMessageId === message.id}
                  groupedWithPrevious={sameDirAsPrev}
                  groupedWithNext={sameDirAsNext}
                  showSenderLabel={showSenderLabel}
                  canDeleteForEveryone={canDeleteForEveryone}
                  onDeleteForEveryone={onDeleteForEveryone}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
