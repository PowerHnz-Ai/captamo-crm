"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search } from "lucide-react";
import { ConversationActionsMenu } from "@/components/chat/ConversationActionsMenu";
import {
  countActiveInboxFilters,
  InboxFilterPanel,
  type InboxFiltersState,
  type InboxPeriodFilter,
} from "@/components/chat/InboxFilterPanel";
import { isWithinConversationWindow, toDate } from "@/lib/conversation-window";
import {
  contactAvatarColors,
  contactInitials,
  previewMessageIcon,
  previewMessageText,
} from "@/lib/chat-utils";
import { ThreadListSkeleton } from "@/components/chat/ThreadListSkeleton";
import { UserAvatar } from "@/components/users/UserAvatar";
import type { ConversationListItem } from "@/lib/types";

interface AssigneeOption {
  uid: string;
  name: string;
  photoUrl?: string;
}

interface ThreadListProps {
  conversations: ConversationListItem[];
  selectedId: string | null;
  loading: boolean;
  statusFilter: string;
  unreadOnly: boolean;
  mineOnly: boolean;
  noResponseOnly: boolean;
  periodFilter: InboxPeriodFilter;
  onStatusFilterChange: (value: string) => void;
  onUnreadOnlyChange: (value: boolean) => void;
  onMineOnlyChange: (value: boolean) => void;
  onNoResponseOnlyChange: (value: boolean) => void;
  onPeriodFilterChange: (value: InboxPeriodFilter) => void;
  onSelect: (id: string) => void;
  showMineFilter?: boolean;
  monitorMode?: boolean;
  listError?: string;
  onRetry?: () => void;
  tagFilter?: string;
  onTagFilterChange?: (value: string) => void;
  tagOptions?: string[];
  windowFilter?: string;
  onWindowFilterChange?: (value: string) => void;
  assigneeFilter?: string;
  onAssigneeFilterChange?: (value: string) => void;
  assigneeOptions?: AssigneeOption[];
  showAssigneeFilter?: boolean;
  showUnassignedOnly?: boolean;
  showNoResponseFilter?: boolean;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  unassignedCount?: number;
  onShowUnassigned?: () => void;
  currentUid?: string;
  canAssignAnyone?: boolean;
  onConversationUpdated?: (conversation: ConversationListItem) => void;
  onConversationDeleted?: (conversationId: string) => void;
}

export function ThreadList({
  conversations,
  selectedId,
  loading,
  statusFilter,
  unreadOnly,
  mineOnly,
  noResponseOnly,
  periodFilter,
  onStatusFilterChange,
  onUnreadOnlyChange,
  onMineOnlyChange,
  onNoResponseOnlyChange,
  onPeriodFilterChange,
  onSelect,
  showMineFilter,
  monitorMode,
  listError,
  onRetry,
  tagFilter = "",
  onTagFilterChange,
  tagOptions = [],
  windowFilter = "",
  onWindowFilterChange,
  assigneeFilter = "",
  onAssigneeFilterChange,
  assigneeOptions = [],
  showAssigneeFilter,
  showUnassignedOnly,
  showNoResponseFilter,
  searchQuery = "",
  onSearchChange,
  unassignedCount = 0,
  onShowUnassigned,
  currentUid = "",
  canAssignAnyone = false,
  onConversationUpdated,
  onConversationDeleted,
}: ThreadListProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const [openActionsMenuId, setOpenActionsMenuId] = useState<string | null>(null);
  const serverSearch = onSearchChange !== undefined;
  const searchValue = serverSearch ? searchQuery : localSearch;

  const filterState: InboxFiltersState = {
    statusFilter,
    windowFilter,
    periodFilter,
    tagFilter,
    assigneeFilter,
    unreadOnly,
    mineOnly,
    noResponseOnly,
  };

  const activeFilterCount = countActiveInboxFilters(filterState);

  function handleFilterChange(patch: Partial<InboxFiltersState>) {
    if (patch.statusFilter !== undefined) onStatusFilterChange(patch.statusFilter);
    if (patch.unreadOnly !== undefined) onUnreadOnlyChange(patch.unreadOnly);
    if (patch.mineOnly !== undefined) onMineOnlyChange(patch.mineOnly);
    if (patch.noResponseOnly !== undefined) onNoResponseOnlyChange(patch.noResponseOnly);
    if (patch.periodFilter !== undefined) onPeriodFilterChange(patch.periodFilter);
    if (patch.windowFilter !== undefined && onWindowFilterChange) {
      onWindowFilterChange(patch.windowFilter);
    }
    if (patch.tagFilter !== undefined && onTagFilterChange) {
      onTagFilterChange(patch.tagFilter);
    }
    if (patch.assigneeFilter !== undefined && onAssigneeFilterChange) {
      onAssigneeFilterChange(patch.assigneeFilter);
    }
  }

  const filtered = useMemo(() => {
    if (serverSearch) return conversations;
    const q = searchValue.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      [c.contactName, c.phone, c.lastMessagePreview, c.assignedToName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [conversations, searchValue, serverSearch]);

  return (
    <div className="flex h-full flex-col border-r border-app-border" style={{ background: "var(--chat-thread-bg)" }}>
      <div className="shrink-0 space-y-3 border-b border-app-border p-3">
        {onShowUnassigned && unassignedCount > 0 && assigneeFilter !== "__unassigned__" && (
          <button
            type="button"
            onClick={onShowUnassigned}
            className="flex w-full items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left text-sm hover:bg-amber-500/15"
          >
            <span className="font-medium text-amber-200">Não atribuídas</span>
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-200">
              {unassignedCount} aguardando
            </span>
          </button>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-muted" />
          <input
            type="search"
            placeholder="Buscar conversa..."
            value={searchValue}
            onChange={(e) => {
              if (serverSearch) onSearchChange(e.target.value);
              else setLocalSearch(e.target.value);
            }}
            className="w-full rounded-xl border border-app-border bg-app-secondary/50 py-2 pl-9 pr-3 text-sm outline-none focus:border-app-accent"
          />
        </div>
        <InboxFilterPanel
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          filters={filterState}
          onChange={handleFilterChange}
          activeCount={activeFilterCount}
          tagOptions={tagOptions}
          assigneeOptions={assigneeOptions}
          showAssigneeFilter={showAssigneeFilter}
          showMineFilter={showMineFilter}
          showNoResponseFilter={showNoResponseFilter}
          showUnassignedOnly={showUnassignedOnly}
        />
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto py-1.5">
        {listError ? (
          <div className="p-4">
            <p className="text-sm text-red-400">{listError}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 chat-text-meta text-app-accent hover:underline"
              >
                Tentar novamente
              </button>
            )}
          </div>
        ) : loading ? (
          <ThreadListSkeleton />
        ) : filtered.length === 0 ? (
          <p className="p-4 text-sm text-app-subtle">
            {searchValue ? "Nenhuma conversa encontrada." : "Nenhuma conversa."}
          </p>
        ) : (
          filtered.map((conversation) => {
            const active = conversation.id === selectedId;
            const windowOpen = isWithinConversationWindow(conversation.lastInboundAt);
            const isClosed = conversation.status === "closed";
            const lastDate = toDate(conversation.lastMessageAt as Parameters<typeof toDate>[0]);
            const lastAt = lastDate
              ? formatDistanceToNow(lastDate, { addSuffix: true, locale: ptBR })
              : "";

            const preview = conversation.lastMessagePreview || "";
            const previewIcon = previewMessageIcon(preview);
            const seed = conversation.contactName || conversation.phone;
            const avatar = contactAvatarColors(seed);
            const initials = contactInitials(conversation.contactName, conversation.phone);
            const tags = conversation.contactTags || [];
            const assigneeOption = assigneeOptions.find(
              (a) => a.uid === conversation.assignedTo
            );

            const hasUnread = (conversation.unreadCount || 0) > 0;
            const hasMeta =
              Boolean(conversation.assignedToName) ||
              tags.length > 0 ||
              Boolean(conversation.phone) ||
              isClosed;

            return (
              <div
                key={conversation.id}
                className={`group relative px-1.5 ${
                  openActionsMenuId === conversation.id ? "z-50" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  className={`thread-item w-full rounded-xl px-2.5 py-2.5 pr-12 text-left ${
                    active ? "thread-item-selected" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        hasUnread ? "ring-2 ring-app-accent/40" : ""
                      }`}
                      style={{ background: avatar.background, color: avatar.color }}
                    >
                      {initials}
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Linha 1: nome + horário */}
                      <div className="flex items-baseline justify-between gap-2 pr-1">
                        <span
                          className={`truncate text-[0.9375rem] leading-snug ${
                            hasUnread ? "font-semibold text-app-text" : "font-medium text-app-text"
                          }`}
                        >
                          {conversation.contactName || conversation.phone}
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {conversation.assignedToName && (
                            <UserAvatar
                              name={conversation.assignedToName}
                              seed={
                                conversation.assignedToName ||
                                conversation.assignedTo ||
                                ""
                              }
                              photoUrl={assigneeOption?.photoUrl}
                              size="xs"
                              className="ring-1 ring-app-border"
                              title={`Responsável: ${conversation.assignedToName}`}
                            />
                          )}
                          {lastAt && (
                            <span
                              className={`shrink-0 text-[0.6875rem] leading-none ${
                                hasUnread ? "font-semibold text-app-accent" : "text-app-muted"
                              }`}
                            >
                              {lastAt}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Linha 2: prévia + indicadores */}
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p
                          className={`line-clamp-1 text-[0.8125rem] leading-snug ${
                            hasUnread ? "text-app-text/80" : "text-app-subtle"
                          }`}
                        >
                          {monitorMode ? (
                            "Conteúdo oculto (modo monitor)"
                          ) : (
                            <>
                              {previewIcon && <span className="mr-1">{previewIcon}</span>}
                              {previewMessageText(preview) || "Sem mensagens"}
                            </>
                          )}
                        </p>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {!windowOpen && !isClosed && (
                            <span
                              className="h-2 w-2 rounded-full bg-amber-400/80"
                              title="Janela WhatsApp fechada"
                              aria-label="Janela WhatsApp fechada"
                            />
                          )}
                          {hasUnread && (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-app-accent px-1.5 text-[0.625rem] font-bold text-black">
                              {conversation.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Linha 3: meta secundária — discreta, revelada no hover (desktop) */}
                      {hasMeta && (
                        <div className="grid grid-rows-[1fr] transition-all duration-200 lg:grid-rows-[0fr] lg:group-hover:grid-rows-[1fr]">
                          <div className="overflow-hidden">
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              {conversation.assignedToName && (
                                <span className="truncate text-[0.6875rem] font-medium leading-tight text-app-accent">
                                  {conversation.assignedToName}
                                </span>
                              )}
                              {conversation.phone && (
                                <span className="truncate text-[0.6875rem] leading-tight text-app-muted">
                                  {conversation.phone}
                                </span>
                              )}
                              {tags.slice(0, 2).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full border border-app-border bg-white/5 px-1.5 py-px text-[0.625rem] leading-tight text-app-muted"
                                >
                                  {tag}
                                </span>
                              ))}
                              {isClosed && (
                                <span
                                  className="inline-flex items-center rounded-full border border-app-border bg-white/5 px-1.5 py-px text-[0.625rem] font-medium leading-tight text-app-subtle"
                                  title="Atendimento encerrado"
                                >
                                  Encerrada
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </button>

                {currentUid && onConversationUpdated && (
                  <div
                    className="absolute right-2.5 top-2.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ConversationActionsMenu
                      conversation={conversation}
                      currentUid={currentUid}
                      canAssignAnyone={canAssignAnyone}
                      assigneeOptions={assigneeOptions}
                      onUpdated={onConversationUpdated}
                      onDeleted={() => onConversationDeleted?.(conversation.id)}
                      onOpenChange={(isOpen) =>
                        setOpenActionsMenuId(isOpen ? conversation.id : null)
                      }
                      align="right"
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
