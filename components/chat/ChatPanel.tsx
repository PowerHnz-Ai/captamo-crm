"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, PanelRightOpen } from "lucide-react";
import { MessageList } from "@/components/chat/MessageList";
import { ChatComposer, type SendMessageOptions } from "@/components/chat/ChatComposer";
import type { ConnectionOption } from "@/components/chat/ConnectionSwitcher";
import { TemplatePanel, type TemplateSendPayload } from "@/components/chat/TemplatePanel";
import { ContactProfileSheet } from "@/components/chat/ContactProfileSheet";
import { ConversationActionsMenu } from "@/components/chat/ConversationActionsMenu";
import { ChatSkeleton } from "@/components/chat/ChatSkeleton";
import { Badge } from "@/components/ui/Badge";
import { UserAvatar } from "@/components/users/UserAvatar";
import {
  conversationWindowMessage,
  isWithinConversationWindow,
} from "@/lib/conversation-window";
import {
  contactAvatarColors,
  contactInitials,
  mediaKindFromMime,
} from "@/lib/chat-utils";
import type { Contact, ConversationListItem, Message } from "@/lib/types";
import { appAlert, appConfirm } from "@/lib/app-dialog";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import { useChatScroll } from "@/hooks/useChatScroll";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/components/auth/AuthProvider";
import { userChatSignatureName } from "@/lib/user-display";

interface ChatPanelProps {
  conversation: ConversationListItem | null;
  messages: Message[];
  loading: boolean;
  error?: string;
  onBack?: () => void;
  onReload: () => Promise<void>;
  onConversationUpdated?: (conversation: ConversationListItem) => void;
  onConversationDeleted?: (conversationId: string) => void;
  showBackButton?: boolean;
  assigneeOptions?: Array<{ uid: string; name: string; photoUrl?: string }>;
  connections?: ConnectionOption[];
  hasMoreOlder?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
}

export function ChatPanel({
  conversation,
  messages,
  loading,
  error,
  onBack,
  onReload,
  onConversationUpdated,
  onConversationDeleted,
  showBackButton,
  assigneeOptions = [],
  connections: connectionsProp = [],
  hasMoreOlder,
  loadingOlder,
  onLoadOlder,
}: ChatPanelProps) {
  const { profile } = useAuth();
  const { can, role } = usePermissions();
  const [templateOpen, setTemplateOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileContact, setProfileContact] = useState<Contact | null>(null);
  const [templateContact, setTemplateContact] = useState<Contact | null>(null);
  const [pendingMessages, setPendingMessages] = useState<Message[]>([]);
  const [sendError, setSendError] = useState("");
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);
  const pendingUrlsRef = useRef<string[]>([]);
  const phone = conversation?.phone || "";
  const connections = connectionsProp;

  const activeConnection =
    connections.find((c) => c.id === conversation?.connectionId) ||
    connections.find((c) => c.isDefault) ||
    connections[0];
  const isMetaConnection =
    !activeConnection || activeConnection.provider === "meta_cloud";
  const windowOpen =
    !isMetaConnection ||
    isWithinConversationWindow(conversation?.lastInboundAt);
  const composerDisabled = isMetaConnection && !windowOpen;
  const isClosed = conversation?.status === "closed";
  const canAssignAnyone = can("team.view") && role !== "member";
  const currentUid = profile?.uid || "";

  useEffect(() => {
    setPendingMessages([]);
    setSendError("");
    setRetryingMessageId(null);
    pendingUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    pendingUrlsRef.current = [];
  }, [conversation?.id]);

  const canDeleteForEveryone = activeConnection
    ? activeConnection.provider !== "meta_cloud"
    : false;

  const deleteForEveryone = useCallback(
    async (message: Message) => {
      if (!conversation) return;
      const ok = await appConfirm("Apagar esta mensagem para todos?", {
        title: "Apagar para todos",
        destructive: true,
        confirmLabel: "Apagar",
      });
      if (!ok) return;
      try {
        const res = await apiFetch(
          `/api/conversations/${conversation.id}/messages/${message.id}`,
          { method: "DELETE" }
        );
        const data = await parseApiJson<{ error?: string }>(res);
        if (!res.ok) {
          throw new Error(data.error || "Erro ao apagar mensagem.");
        }
        await onReload();
      } catch (err) {
        await appAlert(
          err instanceof Error ? err.message : "Erro ao apagar mensagem.",
          { title: "Erro", variant: "error" }
        );
      }
    },
    [conversation, onReload]
  );

  useEffect(() => {
    if (!profileOpen || !conversation?.id) return;
    apiFetch(`/api/conversations/${conversation.id}`)
      .then((res) =>
        parseApiJson<{ contact?: Contact | null; error?: string }>(res)
      )
      .then((data) => setProfileContact(data.contact || null))
      .catch(() => setProfileContact(null));
  }, [profileOpen, conversation?.id]);

  useEffect(() => {
    if (!templateOpen || !conversation?.id) {
      if (!templateOpen) setTemplateContact(null);
      return;
    }
    apiFetch(`/api/conversations/${conversation.id}`)
      .then((res) =>
        parseApiJson<{ contact?: Contact | null; error?: string }>(res)
      )
      .then((data) => setTemplateContact(data.contact || null))
      .catch(() => setTemplateContact(null));
  }, [templateOpen, conversation?.id]);

  const allMessages = useMemo(
    () => [...messages, ...pendingMessages],
    [messages, pendingMessages]
  );

  const { bottomRef, containerRef } = useChatScroll([
    allMessages.length,
    conversation?.id,
    loading,
  ]);

  const addPending = useCallback(
    (partial: Pick<Message, "type" | "body" | "media">, options?: SendMessageOptions) => {
      const id = `pending-${Date.now()}`;
      const blobUrl = partial.media?.url;
      if (blobUrl?.startsWith("blob:")) {
        pendingUrlsRef.current.push(blobUrl);
      }
      const senderName =
        options?.includeSenderName && profile
          ? userChatSignatureName(profile)
          : undefined;
      const pending: Message = {
        id,
        contactId: conversation?.contactId || "",
        conversationId: conversation?.id || "",
        direction: "outbound",
        type: partial.type,
        body: partial.body,
        status: "accepted",
        media: partial.media,
        ...(senderName && profile?.uid
          ? { sentByUid: profile.uid, sentByName: senderName }
          : {}),
        createdAt: {
          seconds: Math.floor(Date.now() / 1000),
          nanoseconds: 0,
        } as Message["createdAt"],
      };
      setPendingMessages((prev) => [...prev, pending]);
      return id;
    },
    [conversation, profile]
  );

  const removePending = useCallback((id: string) => {
    setPendingMessages((prev) => {
      const removed = prev.find((m) => m.id === id);
      const url = removed?.media?.url;
      if (url?.startsWith("blob:")) {
        URL.revokeObjectURL(url);
        pendingUrlsRef.current = pendingUrlsRef.current.filter((u) => u !== url);
      }
      return prev.filter((m) => m.id !== id);
    });
  }, []);

  const clearAudioPending = useCallback(() => {
    setPendingMessages((prev) => {
      for (const m of prev) {
        if (
          m.id.startsWith("pending-") &&
          m.type === "audio" &&
          m.media?.url?.startsWith("blob:")
        ) {
          URL.revokeObjectURL(m.media.url);
          pendingUrlsRef.current = pendingUrlsRef.current.filter(
            (u) => u !== m.media?.url
          );
        }
      }
      return prev.filter((m) => !(m.id.startsWith("pending-") && m.type === "audio"));
    });
  }, []);

  async function retryFailedMedia(message: Message) {
    if (!conversation?.id) return;
    setRetryingMessageId(message.id);
    setSendError("");

    try {
      const isPending = message.id.startsWith("pending-");

      if (isPending && !message.media?.storagePath && message.media?.url?.startsWith("blob:")) {
        const blobRes = await fetch(message.media.url);
        const blob = await blobRes.blob();
        const mime = message.media.mimeType || blob.type || "audio/webm";
        const ext = mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `audio-retry-${Date.now()}.${ext}`, { type: mime });
        removePending(message.id);
        await uploadAndSendMedia({ file, type: "audio" });
        return;
      }

      if (!message.media?.storagePath) {
        throw new Error("Áudio não disponível para reenvio. Grave novamente.");
      }

      const res = await apiFetch("/api/whatsapp/send-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: phone,
          type: "audio",
          storagePath: message.media.storagePath,
          mimeType: message.media.mimeType || "audio/mpeg",
          filename: "audio.mp3",
          retryMessageId: isPending ? undefined : message.id,
        }),
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Falha ao reenviar áudio.");
      if (isPending) removePending(message.id);
      await onReload();
    } catch (err) {
      setSendError(
        err instanceof Error ? err.message : "Não foi possível reenviar o áudio."
      );
    } finally {
      setRetryingMessageId(null);
    }
  }

  async function sendText(body: string, options?: SendMessageOptions) {
    const pendingId = addPending({ type: "text", body }, options);
    try {
      const res = await apiFetch("/api/whatsapp/send-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: phone,
          body,
          includeSenderName: options?.includeSenderName,
        }),
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Falha ao enviar");
      await onReload();
    } finally {
      removePending(pendingId);
    }
  }

  async function uploadAndSendMedia(
    params: {
      file: File;
      type: "image" | "audio" | "document";
      caption?: string;
    },
    options?: SendMessageOptions
  ) {
    if (!conversation?.id) return;

    setSendError("");
    const pendingId = addPending(
      {
        type: params.type,
        body:
          params.caption ||
          (params.type === "image"
            ? "[imagem]"
            : params.type === "audio"
              ? "[áudio]"
              : params.file.name || "[documento]"),
        media: {
          url: URL.createObjectURL(params.file),
          mimeType: params.file.type,
        },
      },
      options
    );

    try {
      if (params.type === "audio") {
        const formData = new FormData();
        formData.append("file", params.file);
        formData.append("conversationId", conversation.id);
        formData.append("to", phone);

        const sendRes = await apiFetch("/api/whatsapp/send-audio", {
          method: "POST",
          body: formData,
        });
        const sendData = await parseApiJson<{
          error?: string;
          success?: boolean;
          messageId?: string;
        }>(sendRes);
        if (!sendRes.ok || sendData.success !== true) {
          throw new Error(sendData.error || "Falha ao enviar áudio");
        }
        clearAudioPending();
        try {
          await onReload();
        } catch {
          // Envio já concluído.
        }
        return;
      }

      const formData = new FormData();
      formData.append("file", params.file);
      formData.append("conversationId", conversation.id);

      const uploadRes = await apiFetch("/api/whatsapp/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await parseApiJson<{
        storagePath?: string;
        mimeType?: string;
        filename?: string;
        error?: string;
      }>(uploadRes);
      if (!uploadRes.ok || !uploadData.storagePath) {
        throw new Error(uploadData.error || "Falha no upload do áudio");
      }

      setPendingMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                media: {
                  ...m.media,
                  storagePath: uploadData.storagePath,
                  mimeType: uploadData.mimeType || params.file.type,
                },
              }
            : m
        )
      );

      const mediaType =
        params.type === "document"
          ? "document"
          : mediaKindFromMime(uploadData.mimeType || params.file.type);

      const sendRes = await apiFetch("/api/whatsapp/send-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: phone,
          type: mediaType,
          storagePath: uploadData.storagePath,
          mimeType: uploadData.mimeType || params.file.type,
          caption: params.caption,
          filename: uploadData.filename || params.file.name,
          includeSenderName: options?.includeSenderName,
        }),
      });
      const sendData = await parseApiJson<{ error?: string; messageId?: string }>(sendRes);
      if (!sendRes.ok) throw new Error(sendData.error || "Falha ao enviar mídia");
      removePending(pendingId);
      try {
        await onReload();
      } catch {
        // Envio já concluído.
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível enviar o áudio.";
      setPendingMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? { ...m, status: "failed" as const }
            : m
        )
      );
      setSendError(message);
    }
  }

  async function sendTemplate(data: TemplateSendPayload) {
    const res = await apiFetch("/api/whatsapp/send-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: phone,
        templateName: data.templateName,
        language: data.language,
        parameters: data.parameters,
        ...(data.parameterMapping?.length
          ? { parameterMapping: data.parameterMapping }
          : {}),
        ...(data.headerImageStoragePath
          ? { headerImageStoragePath: data.headerImageStoragePath }
          : {}),
        ...(data.headerImageAssetId
          ? { headerImageAssetId: data.headerImageAssetId }
          : {}),
        ...(data.headerImageMode ? { headerImageMode: data.headerImageMode } : {}),
        ...(data.headerImageMapping
          ? { headerImageMapping: data.headerImageMapping }
          : {}),
      }),
    });
    const result = await parseApiJson<{ error?: string }>(res);
    if (!res.ok) throw new Error(result.error || "Falha ao enviar template");
    await onReload();
  }

  async function createLead() {
    if (!conversation?.contactId) return;
    const funnelRes = await apiFetch("/api/funnel");
    const funnelData = await parseApiJson<{ stages?: Array<{ id: string }> }>(funnelRes);
    const firstStage = funnelData.stages?.[0];
    if (!firstStage) {
      await appAlert("Configure o funil primeiro.", {
        title: "Funil não configurado",
        variant: "warning",
      });
      return;
    }

    const res = await apiFetch("/api/funnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: conversation.contactName || conversation.phone,
        contactId: conversation.contactId,
        stageId: firstStage.id,
        source: "inbox",
      }),
    });
    const data = await parseApiJson<{ error?: string }>(res);
    if (!res.ok) {
      await appAlert(data.error || "Erro ao criar lead", { title: "Erro", variant: "error" });
    } else {
      await appAlert("Lead criado no funil!", { title: "Sucesso", variant: "success" });
    }
  }

  if (!conversation) {
    return (
      <div className="chat-wallpaper flex h-full items-center justify-center p-6 text-center">
        <div>
          <p className="font-display text-lg font-semibold">Conversas WhatsApp</p>
          <p className="mt-2 text-sm text-app-subtle">
            Selecione uma conversa para começar o atendimento.
          </p>
        </div>
      </div>
    );
  }

  const seed = conversation.contactName || conversation.phone;
  const avatar = contactAvatarColors(seed);
  const initials = contactInitials(conversation.contactName, conversation.phone);

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <header className="chat-header-bar flex shrink-0 items-center gap-3 px-4 py-3 backdrop-blur">
        {showBackButton && onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg p-2 hover:bg-white/5 lg:hidden"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left hover:opacity-90"
        >
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold"
            style={{ background: avatar.background, color: avatar.color }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold">
              {conversation.contactName || conversation.phone}
            </h2>
            <p className="truncate chat-text-meta text-app-muted">{phone}</p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          {conversation.assignedToName && (
            <div className="flex items-center gap-1.5 rounded-full border border-app-border bg-app-secondary/40 px-2 py-1">
              <UserAvatar
                name={conversation.assignedToName}
                seed={conversation.assignedToName}
                photoUrl={
                  assigneeOptions.find((a) => a.uid === conversation.assignedTo)?.photoUrl
                }
                size="xs"
              />
              <span className="max-w-[8rem] truncate text-xs text-app-subtle">
                {conversation.assignedToName}
              </span>
            </div>
          )}
          {isClosed && (
            <Badge tone="neutral" title="Atendimento encerrado no CRM">
              Encerrada
            </Badge>
          )}
          {isMetaConnection && (
            <Badge tone={windowOpen ? "success" : "warning"}>
              {windowOpen ? "24h aberta" : "24h fechada"}
            </Badge>
          )}
          {currentUid && onConversationUpdated && (
            <ConversationActionsMenu
              conversation={conversation}
              currentUid={currentUid}
              canAssignAnyone={canAssignAnyone}
              assigneeOptions={assigneeOptions}
              onUpdated={(updated) => {
                onConversationUpdated(updated);
              }}
              onAfterMarkUnread={onBack}
              onDeleted={() => onConversationDeleted?.(conversation.id)}
            />
          )}
          <button
            type="button"
            onClick={() => setTemplateOpen((v) => !v)}
            className="rounded-lg border border-app-border p-2 hover:bg-white/5"
            aria-label="Templates"
          >
            <PanelRightOpen className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={createLead}
            className="hidden rounded-lg border border-app-border px-3 py-1.5 text-xs text-app-subtle hover:text-app-text sm:block"
          >
            Criar lead
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="chat-wallpaper min-h-0 flex-1 overflow-hidden">
            <div
              ref={containerRef}
              className="relative z-10 h-full overflow-y-auto px-4 py-3"
            >
            {error && (
              <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}
            {loading && messages.length === 0 && !error ? (
              <ChatSkeleton />
            ) : allMessages.length === 0 ? (
              <p className="text-center text-sm text-app-muted">Nenhuma mensagem.</p>
            ) : (
              <MessageList
                messages={allMessages}
                conversationId={conversation.id}
                onRetry={retryFailedMedia}
                retryingMessageId={retryingMessageId}
                canDeleteForEveryone={canDeleteForEveryone}
                onDeleteForEveryone={deleteForEveryone}
                hasMoreOlder={hasMoreOlder}
                loadingOlder={loadingOlder}
                onLoadOlder={onLoadOlder}
              />
            )}
            <div ref={bottomRef} />
            </div>
          </div>

          <div className="chat-composer-footer shrink-0 px-3 py-2 backdrop-blur">
            <ChatComposer
              disabled={composerDisabled}
              disabledReason={composerDisabled ? conversationWindowMessage() : undefined}
              sendError={sendError}
              onDismissError={() => setSendError("")}
              conversationId={conversation.id}
              conversation={conversation}
              onConversationUpdated={onConversationUpdated}
              connections={connections}
              contactName={conversation.contactName}
              contactPhone={conversation.phone}
              onSendText={sendText}
              onSendMedia={uploadAndSendMedia}
            />
          </div>
        </div>

        {templateOpen && (
          <aside className="hidden w-96 shrink-0 overflow-y-auto border-l border-app-border bg-app-secondary/40 p-4 lg:block">
            <TemplatePanel
              contact={templateContact}
              contactName={conversation.contactName}
              contactPhone={conversation.phone}
              onSend={sendTemplate}
            />
          </aside>
        )}
      </div>

      {templateOpen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-app-card lg:hidden">
          <div className="flex items-center justify-between border-b border-app-border px-4 py-3">
            <h3 className="font-semibold">Templates</h3>
            <button
              type="button"
              onClick={() => setTemplateOpen(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-app-muted hover:bg-white/5"
            >
              Fechar
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
            <TemplatePanel
              contact={templateContact}
              contactName={conversation.contactName}
              contactPhone={conversation.phone}
              onSend={async (data) => {
                await sendTemplate(data);
                setTemplateOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {profileOpen && (
        <ContactProfileSheet
          conversation={conversation}
          contact={profileContact}
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          onUpdated={() => void onReload()}
          assigneeOptions={assigneeOptions}
          canReassign={canAssignAnyone}
          currentUid={currentUid}
          onConversationUpdated={onConversationUpdated}
        />
      )}
    </div>
  );
}
