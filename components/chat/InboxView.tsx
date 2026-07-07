"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ThreadList } from "@/components/chat/ThreadList";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { MonitorPanel } from "@/components/chat/MonitorPanel";
import { InboxPanelResizeHandle } from "@/components/chat/InboxPanelResizeHandle";
import { InboxRail, type InboxRailAttendant } from "@/components/chat/InboxRail";
import type { ConnectionOption } from "@/components/chat/ConnectionSwitcher";
import { useAuth } from "@/components/auth/AuthProvider";
import { usePermissions } from "@/hooks/usePermissions";
import { useResizablePanel } from "@/hooks/useResizablePanel";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import { mergeMessagesById } from "@/lib/message-merge";
import { phonesMatch } from "@/lib/whatsapp/phone";
import { useRealtimeInbox } from "@/hooks/useRealtimeInbox";
import type { RealtimeEvent } from "@/lib/realtime";
import type { InboxPeriodFilter } from "@/components/chat/InboxFilterPanel";
import type { ConversationListItem, Message } from "@/lib/types";

const POLL_MS = 5000;
/** Com a aba oculta, só o contador barato continua — em ritmo mais lento. */
const HIDDEN_POLL_MS = 30000;
/** Com SSE conectado, o polling vira só rede de segurança. */
const REALTIME_FALLBACK_POLL_MS = 60_000;
const REALTIME_HIDDEN_POLL_MS = 300_000;
/** Junta eventos SSE em rajada (ex.: campanha) num único reload. */
const REALTIME_DEBOUNCE_MS = 400;
const SEARCH_DEBOUNCE_MS = 350;
const MESSAGE_PAGE_SIZE = 30;

/** Beep curto via WebAudio — sem depender de asset de áudio. */
function playNotificationSound() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    window.setTimeout(() => void ctx.close(), 600);
  } catch {
    // som é melhoria progressiva — falha silenciosa
  }
}

function showDesktopNotification(count: number) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  if (!document.hidden) return;
  try {
    const n = new Notification("API Captamo — nova mensagem", {
      body:
        count === 1
          ? "Você tem 1 conversa não lida."
          : `Você tem ${count} conversas não lidas.`,
      tag: "ultra-inbox-unread",
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // melhoria progressiva
  }
}

interface InboxViewProps {
  basePath?: string;
}

interface MessagePaginationState {
  hasMore: boolean;
  oldestCursor?: number;
}

function inboxErrorMessage(status: number, apiError?: string): string {
  if (apiError) return apiError;
  if (status === 401) return "Sessão expirada. Faça login novamente.";
  if (status === 403) return "Sem permissão para ver conversas.";
  return `Erro ao carregar conversas (${status}).`;
}

function messagesErrorMessage(status: number, apiError?: string): string {
  if (apiError) return apiError;
  if (status === 401) return "Sessão expirada. Faça login novamente.";
  if (status === 403) return "Sem permissão para ler mensagens desta conversa.";
  return `Erro ao carregar mensagens (${status}).`;
}

export function InboxView({ basePath = "/conversations" }: InboxViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedIdFromUrl = searchParams.get("id");
  const phoneParam = searchParams.get("phone");
  const inboxFromUrl = searchParams.get("inbox");
  const { loading: authLoading, profile, refreshProfile } = useAuth();
  const { can, role } = usePermissions();

  const canReadMessages = can("conversations.read_content");
  const canMonitor = can("conversations.monitor");
  const monitorMode = canMonitor && !canReadMessages;
  const { width: inboxPanelWidth, isResizing, onResizeStart } = useResizablePanel();

  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<ConversationListItem | null>(null);
  const [activeId, setActiveId] = useState<string | null>(selectedIdFromUrl);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const [tagFilter, setTagFilter] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const [windowFilter, setWindowFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState<InboxPeriodFilter>("");
  const [noResponseOnly, setNoResponseOnly] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(
    inboxFromUrl
  );
  const [connections, setConnections] = useState<ConnectionOption[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [unreadByConnection, setUnreadByConnection] = useState<
    Record<string, number>
  >({});
  const [assigneeOptions, setAssigneeOptions] = useState<
    Array<{ uid: string; name: string; photoUrl?: string }>
  >([]);
  const [railAttendants, setRailAttendants] = useState<InboxRailAttendant[]>([]);
  const [attendantsLoading, setAttendantsLoading] = useState(true);

  const isMember = role === "member";
  const canViewTeam = can("team.view");
  const canAssignAnyone = canViewTeam && !isMember;
  const canLoadInbox = !authLoading && Boolean(profile);

  const activeDetailIdRef = useRef<string | null>(activeId);
  const hasLoadedListRef = useRef(false);
  const messageCacheRef = useRef<Map<string, Message[]>>(new Map());
  const paginationRef = useRef<Map<string, MessagePaginationState>>(new Map());
  const prevTotalUnreadRef = useRef<number | null>(null);
  const [pageVisible, setPageVisible] = useState(true);

  // Pausa o polling pesado com a aba oculta; notificação assume o papel.
  useEffect(() => {
    const onVisibility = () => setPageVisible(!document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Pede permissão de notificação desktop uma vez (no primeiro clique).
  useEffect(() => {
    if (!canLoadInbox || typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;
    const request = () => {
      void Notification.requestPermission();
      window.removeEventListener("click", request);
    };
    window.addEventListener("click", request, { once: true });
    return () => window.removeEventListener("click", request);
  }, [canLoadInbox]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setActiveId(selectedIdFromUrl);
  }, [selectedIdFromUrl]);

  useEffect(() => {
    if (inboxFromUrl) setActiveConnectionId(inboxFromUrl);
  }, [inboxFromUrl]);

  useEffect(() => {
    if (!canLoadInbox || monitorMode) {
      setConnectionsLoading(false);
      return;
    }

    let active = true;
    setConnectionsLoading(true);
    apiFetch("/api/connections")
      .then((res) => parseApiJson<{ connections?: ConnectionOption[] }>(res))
      .then((data) => {
        if (!active) return;
        const list = data.connections || [];
        setConnections(list);
        if (list.length > 0) {
          setActiveConnectionId((prev) => {
            if (prev && list.some((c) => c.id === prev)) return prev;
            const defaultConn = list.find((c) => c.isDefault) || list[0];
            return defaultConn?.id ?? null;
          });
        }
      })
      .catch(() => {
        if (active) setConnections([]);
      })
      .finally(() => {
        if (active) setConnectionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [canLoadInbox, monitorMode]);

  const switchInbox = useCallback(
    (connectionId: string) => {
      setActiveConnectionId(connectionId);
      const params = new URLSearchParams(searchParams.toString());
      params.set("inbox", connectionId);
      router.replace(`${basePath}?${params.toString()}`);
    },
    [searchParams, router, basePath]
  );

  const handleAssigneeFilterChange = useCallback((value: string) => {
    setAssigneeFilter(value);
    setMineOnly(false);
  }, []);

  const openCountByAssignee = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const conversation of conversations) {
      if (conversation.status === "open" && conversation.assignedTo) {
        counts[conversation.assignedTo] =
          (counts[conversation.assignedTo] || 0) + 1;
      }
    }
    return counts;
  }, [conversations]);

  const loadConversations = useCallback(async () => {
    if (!canLoadInbox) return [];
    if (connections.length > 0 && !activeConnectionId) return [];

    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (unreadOnly) params.set("unread", "true");
    if (tagFilter) params.set("tag", tagFilter);
    if (labelFilter) params.set("label", labelFilter);
    if (windowFilter) params.set("window", windowFilter);
    if (periodFilter) params.set("period", periodFilter);
    if (noResponseOnly) params.set("noResponse", "true");
    if (searchQuery) params.set("search", searchQuery);
    if (assigneeFilter) {
      params.set("assignedTo", assigneeFilter);
    } else if (mineOnly && profile?.uid) {
      params.set("assignedTo", profile.uid);
    }
    if (activeConnectionId) params.set("connectionId", activeConnectionId);
    if (monitorMode) params.set("monitor", "true");

    try {
      const res = await apiFetch(`/api/conversations?${params}`);
      const data = await parseApiJson<{
        conversations?: ConversationListItem[];
        error?: string;
      }>(res);

      if (!res.ok) {
        throw new Error(inboxErrorMessage(res.status, data.error));
      }

      const items = (data.conversations || []).map((c) => {
        const currentActiveId = activeDetailIdRef.current;
        if (currentActiveId && c.id === currentActiveId && (c.unreadCount ?? 0) > 0) {
          return { ...c, unreadCount: 0 };
        }
        return c;
      });
      setConversations(items);
      setListError("");
      return items;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar conversas.";
      setListError(message);
      setConversations([]);
      return [];
    }
  }, [
    canLoadInbox,
    statusFilter,
    unreadOnly,
    mineOnly,
    tagFilter,
    labelFilter,
    windowFilter,
    periodFilter,
    assigneeFilter,
    noResponseOnly,
    searchQuery,
    profile?.uid,
    monitorMode,
    activeConnectionId,
    connections.length,
  ]);

  const applyMessagesForConversation = useCallback(
    (
      conversationId: string,
      nextMessages: Message[],
      pagination: MessagePaginationState
    ) => {
      messageCacheRef.current.set(conversationId, nextMessages);
      paginationRef.current.set(conversationId, pagination);
      if (activeDetailIdRef.current === conversationId) {
        setMessages(nextMessages);
        setHasMoreOlder(pagination.hasMore);
      }
    },
    []
  );

  const loadConversationDetail = useCallback(
    async (id: string, options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      const cached = messageCacheRef.current.get(id);
      const cachedPagination = paginationRef.current.get(id);

      if (cached) {
        setMessages(cached);
        setHasMoreOlder(cachedPagination?.hasMore ?? false);
      }

      if (!silent && !cached) {
        setChatLoading(true);
      }

      const isStale = () => activeDetailIdRef.current !== id;

      try {
        const convRes = await apiFetch(`/api/conversations/${id}`);
        const convData = await parseApiJson<{
          conversation?: ConversationListItem;
          error?: string;
        }>(convRes);
        if (isStale()) return;
        if (convRes.ok) {
          setSelectedConversation(convData.conversation || null);
        }

        if (!monitorMode) {
          // markRead só ao abrir ou quando há não lidas — evita uma escrita
          // no banco a cada ciclo de poll.
          const hasUnread = (convData.conversation?.unreadCount ?? 0) > 0;
          if (!silent || hasUnread) {
            void apiFetch(`/api/conversations/${id}`, {
              method: "PATCH",
              body: JSON.stringify({ markRead: true }),
            });
          }

          const msgRes = await apiFetch(
            `/api/conversations/${id}/messages?limit=${MESSAGE_PAGE_SIZE}`
          );
          const msgData = await parseApiJson<{
            messages?: Message[];
            hasMore?: boolean;
            oldestCursor?: number;
            error?: string;
          }>(msgRes);
          if (isStale()) return;
          if (msgRes.ok) {
            const incoming = msgData.messages || [];
            const merged = cached
              ? mergeMessagesById(cached, incoming)
              : incoming;
            applyMessagesForConversation(id, merged, {
              hasMore: Boolean(msgData.hasMore),
              oldestCursor: msgData.oldestCursor,
            });
            setChatError("");
          } else {
            setChatError(messagesErrorMessage(msgRes.status, msgData.error));
          }
        } else {
          applyMessagesForConversation(id, [], { hasMore: false });
          setChatError("");
        }
      } catch (err) {
        if (isStale()) return;
        const message =
          err instanceof Error ? err.message : "Erro ao carregar conversa.";
        if (!silent) setChatError(message);
      } finally {
        if (!silent && !isStale()) setChatLoading(false);
      }
    },
    [monitorMode, applyMessagesForConversation]
  );

  const loadOlderMessages = useCallback(async () => {
    const id = activeDetailIdRef.current;
    if (!id || loadingOlder) return;

    const pagination = paginationRef.current.get(id);
    if (!pagination?.hasMore || !pagination.oldestCursor) return;

    setLoadingOlder(true);
    try {
      const msgRes = await apiFetch(
        `/api/conversations/${id}/messages?limit=${MESSAGE_PAGE_SIZE}&before=${pagination.oldestCursor}`
      );
      const msgData = await parseApiJson<{
        messages?: Message[];
        hasMore?: boolean;
        oldestCursor?: number;
        error?: string;
      }>(msgRes);

      if (!msgRes.ok) {
        throw new Error(msgData.error || "Erro ao carregar mensagens anteriores.");
      }

      if (activeDetailIdRef.current !== id) return;

      const current = messageCacheRef.current.get(id) || [];
      const merged = mergeMessagesById(msgData.messages || [], current);
      applyMessagesForConversation(id, merged, {
        hasMore: Boolean(msgData.hasMore),
        oldestCursor: msgData.oldestCursor ?? pagination.oldestCursor,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao carregar mensagens anteriores.";
      setChatError(message);
    } finally {
      setLoadingOlder(false);
    }
  }, [applyMessagesForConversation, loadingOlder]);

  useEffect(() => {
    if (!canLoadInbox) return;

    let active = true;
    if (!hasLoadedListRef.current) setListLoading(true);
    loadConversations().finally(() => {
      if (active) {
        hasLoadedListRef.current = true;
        setListLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [canLoadInbox, loadConversations]);

  useEffect(() => {
    if (!canLoadInbox || !canViewTeam) return;
    apiFetch("/api/team")
      .then((res) =>
        parseApiJson<{
          users?: Array<{ uid: string; name?: string; email?: string; photoUrl?: string }>;
        }>(res)
      )
      .then((data) => {
        setAssigneeOptions(
          (data.users || []).map((u) => ({
            uid: u.uid,
            name: u.name || u.email || u.uid,
            photoUrl: u.photoUrl,
          }))
        );
      })
      .catch(() => setAssigneeOptions([]));
  }, [canLoadInbox, canViewTeam]);

  useEffect(() => {
    if (!canLoadInbox || monitorMode) {
      setAttendantsLoading(false);
      return;
    }

    let active = true;
    setAttendantsLoading(true);
    apiFetch("/api/inbox/attendants")
      .then((res) => parseApiJson<{ attendants?: InboxRailAttendant[] }>(res))
      .then((data) => {
        if (active) setRailAttendants(data.attendants || []);
      })
      .catch(() => {
        if (active) setRailAttendants([]);
      })
      .finally(() => {
        if (active) setAttendantsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [canLoadInbox, monitorMode]);

  useEffect(() => {
    if (!canLoadInbox || monitorMode) return;

    const params = new URLSearchParams();
    params.set("assignedTo", "__unassigned__");
    params.set("window", "open");
    if (activeConnectionId) params.set("connectionId", activeConnectionId);

    apiFetch(`/api/conversations?${params}`)
      .then((res) =>
        parseApiJson<{ conversations?: ConversationListItem[] }>(res)
      )
      .then((data) => {
        setUnassignedCount(data.conversations?.length ?? 0);
      })
      .catch(() => setUnassignedCount(0));
  }, [canLoadInbox, monitorMode, activeConnectionId]);

  const loadUnreadCounts = useCallback(async () => {
    if (!canLoadInbox || connections.length === 0) return;
    const defaultConnectionId =
      connections.find((c) => c.isDefault)?.id || connections[0]?.id;

    try {
      const res = await apiFetch("/api/conversations/unread-counts");
      const data = await parseApiJson<{
        byConnection?: Record<string, number>;
        unassignedConnection?: number;
        total?: number;
      }>(res);
      if (!res.ok) return;

      const counts: Record<string, number> = { ...(data.byConnection || {}) };
      // Conversas sem conexão definida pertencem à conexão default.
      if (data.unassignedConnection && defaultConnectionId) {
        counts[defaultConnectionId] =
          (counts[defaultConnectionId] || 0) + data.unassignedConnection;
      }
      setUnreadByConnection(counts);

      // Notifica quando o total de não lidas aumenta.
      const total = data.total || 0;
      const prev = prevTotalUnreadRef.current;
      prevTotalUnreadRef.current = total;
      if (prev !== null && total > prev) {
        playNotificationSound();
        showDesktopNotification(total);
      }
    } catch {
      // silencioso — próximo ciclo tenta de novo
    }
  }, [canLoadInbox, connections]);

  // Tempo real (SSE): eventos disparam os loaders existentes com debounce;
  // o polling continua como rede de segurança em ritmo lento.
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeTouchedActiveRef = useRef(false);

  const handleRealtimeEvent = useCallback(
    (event: RealtimeEvent) => {
      if (event.conversationId === activeDetailIdRef.current) {
        realtimeTouchedActiveRef.current = true;
      }
      if (realtimeTimerRef.current) return;
      realtimeTimerRef.current = setTimeout(() => {
        realtimeTimerRef.current = null;
        const touchedActive = realtimeTouchedActiveRef.current;
        realtimeTouchedActiveRef.current = false;
        void loadConversations();
        void loadUnreadCounts();
        const currentActiveId = activeDetailIdRef.current;
        if (touchedActive && currentActiveId) {
          void loadConversationDetail(currentActiveId, { silent: true });
        }
      }, REALTIME_DEBOUNCE_MS);
    },
    [loadConversations, loadUnreadCounts, loadConversationDetail]
  );

  useEffect(() => {
    return () => {
      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
    };
  }, []);

  const { connected: realtimeConnected } = useRealtimeInbox({
    enabled: canLoadInbox && !monitorMode,
    onEvent: handleRealtimeEvent,
  });

  useEffect(() => {
    if (!canLoadInbox || connections.length === 0) return;
    void loadUnreadCounts();
    const intervalMs = realtimeConnected
      ? pageVisible
        ? REALTIME_FALLBACK_POLL_MS
        : REALTIME_HIDDEN_POLL_MS
      : pageVisible
        ? POLL_MS
        : HIDDEN_POLL_MS;
    const timer = setInterval(() => void loadUnreadCounts(), intervalMs);
    return () => clearInterval(timer);
  }, [canLoadInbox, connections, pageVisible, realtimeConnected, loadUnreadCounts]);

  function handleConversationUpdated(updated: ConversationListItem) {
    setConversations((prev) =>
      prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
    );
    setSelectedConversation((prev) =>
      prev?.id === updated.id ? { ...prev, ...updated } : prev
    );
    if (updated.connectionId && updated.connectionId !== activeConnectionId) {
      switchInbox(updated.connectionId);
    }
  }

  function handleConversationDeleted(deletedId: string) {
    setConversations((prev) => prev.filter((c) => c.id !== deletedId));
    messageCacheRef.current.delete(deletedId);
    paginationRef.current.delete(deletedId);
    if (activeId === deletedId) {
      activeDetailIdRef.current = null;
      setActiveId(null);
      setSelectedConversation(null);
      setMessages([]);
      setChatError("");
      router.replace(
        activeConnectionId ? `${basePath}?inbox=${activeConnectionId}` : basePath
      );
    }
    void loadConversations();
  }

  function showUnassignedQueue() {
    handleAssigneeFilterChange("__unassigned__");
  }

  const tagOptions = [
    ...new Set(conversations.flatMap((c) => c.contactTags || [])),
  ].sort();

  const labelOptions = [
    ...new Set(conversations.flatMap((c) => c.labels || [])),
  ].sort();

  useEffect(() => {
    if (!phoneParam || activeId) return;
    const match = conversations.find((c) => phonesMatch(c.phone, phoneParam));
    if (match) {
      setActiveId(match.id);
      const params = new URLSearchParams();
      params.set("id", match.id);
      if (activeConnectionId) params.set("inbox", activeConnectionId);
      router.replace(`${basePath}?${params.toString()}`);
    }
  }, [phoneParam, activeId, conversations, router, basePath, activeConnectionId]);

  useEffect(() => {
    activeDetailIdRef.current = activeId;
    if (!activeId) {
      setSelectedConversation(null);
      setMessages([]);
      setChatError("");
      setHasMoreOlder(false);
      return;
    }

    const cached = messageCacheRef.current.get(activeId);
    if (cached) {
      setMessages(cached);
      const pagination = paginationRef.current.get(activeId);
      setHasMoreOlder(pagination?.hasMore ?? false);
    }

    setChatError("");
    void loadConversationDetail(activeId, { silent: Boolean(cached) });
  }, [activeId, loadConversationDetail]);

  useEffect(() => {
    if (!activeId) return;
    const fromList = conversations.find((c) => c.id === activeId);
    if (!fromList) return;
    setSelectedConversation((prev) =>
      prev?.id === activeId
        ? { ...prev, ...fromList, unreadCount: 0 }
        : fromList
    );
  }, [activeId, conversations]);

  // Ao voltar para a aba, atualiza a lista imediatamente (dados ficaram velhos).
  useEffect(() => {
    if (pageVisible && canLoadInbox && hasLoadedListRef.current) {
      void loadConversations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageVisible]);

  useEffect(() => {
    // Polling pesado (lista + detalhe) só com a aba visível; com SSE
    // conectado vira apenas rede de segurança em ritmo lento.
    if (!canLoadInbox || !pageVisible) return;

    const timer = setInterval(() => {
      void loadConversations().then((items) => {
        if (!activeId) return;
        const found = items.find((c) => c.id === activeId);
        if (found) {
          setSelectedConversation((prev) =>
            prev?.id === activeId
              ? { ...prev, ...found, unreadCount: 0 }
              : found
          );
        }
        void loadConversationDetail(activeId, { silent: true });
      });
    }, realtimeConnected ? REALTIME_FALLBACK_POLL_MS : POLL_MS);
    return () => clearInterval(timer);
  }, [
    canLoadInbox,
    pageVisible,
    realtimeConnected,
    loadConversations,
    loadConversationDetail,
    activeId,
  ]);

  function selectConversation(id: string) {
    activeDetailIdRef.current = id;
    setActiveId(id);
    const item = conversations.find((c) => c.id === id);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
    );
    if (item) setSelectedConversation({ ...item, unreadCount: 0 });

    const cached = messageCacheRef.current.get(id);
    if (cached) {
      setMessages(cached);
      const pagination = paginationRef.current.get(id);
      setHasMoreOlder(pagination?.hasMore ?? false);
    }

    setChatError("");

    const params = new URLSearchParams();
    params.set("id", id);
    if (activeConnectionId) params.set("inbox", activeConnectionId);
    router.push(`${basePath}?${params.toString()}`);
  }

  function clearSelection() {
    activeDetailIdRef.current = null;
    setActiveId(null);
    const params = new URLSearchParams();
    if (activeConnectionId) params.set("inbox", activeConnectionId);
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  async function reloadChat() {
    if (!activeId) return;
    messageCacheRef.current.delete(activeId);
    paginationRef.current.delete(activeId);
    await Promise.all([
      loadConversations(),
      loadConversationDetail(activeId, { silent: false }),
    ]);
  }

  async function retryList() {
    if (listError.toLowerCase().includes("login")) {
      await refreshProfile();
    }
    setListLoading(true);
    await loadConversations();
    setListLoading(false);
  }

  const showChatOnMobile = Boolean(activeId);

  return (
    <div className="flex h-full min-h-0">
      {!monitorMode && (
        <InboxRail
          connections={connections}
          connectionsLoading={connectionsLoading}
          activeConnectionId={activeConnectionId}
          onConnectionChange={switchInbox}
          unreadByConnection={unreadByConnection}
          attendants={railAttendants}
          attendantsLoading={attendantsLoading}
          assigneeFilter={assigneeFilter}
          onAssigneeFilterChange={handleAssigneeFilterChange}
          openCountByAssignee={openCountByAssignee}
          unassignedCount={unassignedCount}
          showUsersSection={canReadMessages}
          currentUid={profile?.uid}
        />
      )}

      <div
        className={`inbox-panel-resizable flex min-h-0 w-full shrink-0 flex-col ${
          showChatOnMobile ? "hidden lg:flex" : "flex"
        }`}
        style={
          { "--inbox-panel-width": `${inboxPanelWidth}px` } as React.CSSProperties
        }
      >
        <ThreadList
          conversations={conversations}
          selectedId={activeId}
          loading={listLoading && conversations.length === 0}
          listError={listError}
          onRetry={retryList}
          statusFilter={statusFilter}
          unreadOnly={unreadOnly}
          mineOnly={mineOnly}
          noResponseOnly={noResponseOnly}
          onStatusFilterChange={setStatusFilter}
          onUnreadOnlyChange={setUnreadOnly}
          onMineOnlyChange={setMineOnly}
          onNoResponseOnlyChange={setNoResponseOnly}
          periodFilter={periodFilter}
          onPeriodFilterChange={setPeriodFilter}
          onSelect={selectConversation}
          showMineFilter={isMember && canReadMessages}
          monitorMode={monitorMode}
          tagFilter={tagFilter}
          onTagFilterChange={setTagFilter}
          tagOptions={tagOptions}
          labelFilter={labelFilter}
          onLabelFilterChange={setLabelFilter}
          labelOptions={labelOptions}
          windowFilter={windowFilter}
          onWindowFilterChange={setWindowFilter}
          assigneeFilter={assigneeFilter}
          onAssigneeFilterChange={handleAssigneeFilterChange}
          assigneeOptions={assigneeOptions}
          showAssigneeFilter={(canViewTeam || isMember) && !monitorMode}
          showUnassignedOnly={isMember && !canViewTeam}
          showNoResponseFilter={canViewTeam && !monitorMode}
          searchQuery={searchInput}
          onSearchChange={setSearchInput}
          unassignedCount={unassignedCount}
          onShowUnassigned={showUnassignedQueue}
          currentUid={profile?.uid}
          canAssignAnyone={canAssignAnyone}
          onConversationUpdated={handleConversationUpdated}
          onConversationDeleted={handleConversationDeleted}
        />
      </div>

      <InboxPanelResizeHandle
        onResizeStart={onResizeStart}
        isResizing={isResizing}
      />

      <div
        className={`min-w-0 flex-1 ${
          showChatOnMobile ? "flex flex-col" : "hidden lg:flex lg:flex-col"
        }`}
      >
        {monitorMode ? (
          <MonitorPanel
            conversation={selectedConversation}
            loading={chatLoading}
            onBack={clearSelection}
            showBackButton
          />
        ) : (
          <ChatPanel
            conversation={selectedConversation}
            messages={messages}
            loading={chatLoading}
            error={chatError}
            onBack={clearSelection}
            onReload={reloadChat}
            onConversationUpdated={handleConversationUpdated}
            onConversationDeleted={handleConversationDeleted}
            showBackButton
            assigneeOptions={assigneeOptions}
            connections={connections}
            hasMoreOlder={hasMoreOlder}
            loadingOlder={loadingOlder}
            onLoadOlder={() => void loadOlderMessages()}
          />
        )}
      </div>
    </div>
  );
}
