"use client";

import { useEffect, useRef, useState } from "react";
import { X, StickyNote, MessageSquare } from "lucide-react";
import { AttachmentMenu } from "@/components/chat/AttachmentMenu";
import { AudioRecordingBar } from "@/components/chat/AudioRecordingBar";
import { ConnectionSwitcher, type ConnectionOption } from "@/components/chat/ConnectionSwitcher";
import { QuickReplyPicker } from "@/components/chat/QuickReplyPicker";
import { Switch } from "@/components/ui/Switch";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import type { ConversationListItem, Message } from "@/lib/types";

const INCLUDE_SENDER_NAME_KEY = "ultra-chat-include-sender-name";

export interface SendMessageOptions {
  includeSenderName?: boolean;
}

interface ChatComposerProps {
  disabled?: boolean;
  disabledReason?: string;
  sendError?: string;
  onDismissError?: () => void;
  conversationId: string;
  conversation: ConversationListItem;
  onConversationUpdated?: (conversation: ConversationListItem) => void;
  connections?: ConnectionOption[];
  contactName?: string;
  contactPhone?: string;
  onSendText: (body: string, options?: SendMessageOptions) => Promise<void>;
  onSendMedia: (params: {
    file: File;
    type: "image" | "audio" | "document";
    caption?: string;
  }, options?: SendMessageOptions) => Promise<void>;
  /** Nota interna — habilita a aba "Nota" quando presente. */
  onSendNote?: (body: string) => Promise<void>;
  /** Mensagem sendo respondida (citação). */
  replyingTo?: Message | null;
  onCancelReply?: () => void;
}

function readIncludeSenderNamePreference(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(INCLUDE_SENDER_NAME_KEY) === "1";
}

export function ChatComposer({
  disabled,
  disabledReason,
  sendError,
  onDismissError,
  conversationId,
  conversation,
  onConversationUpdated,
  connections,
  contactName,
  contactPhone,
  onSendText,
  onSendMedia,
  onSendNote,
  replyingTo,
  onCancelReply,
}: ChatComposerProps) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [includeSenderName, setIncludeSenderName] = useState(false);
  const [mode, setMode] = useState<"message" | "note">("message");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const audioRecorder = useAudioRecorder();

  const slashQuery =
    mode === "message" && body.startsWith("/") ? body.slice(1) : undefined;
  const isRecordingUi = audioRecorder.isActive;
  const noteMode = mode === "note";
  // Nota interna funciona mesmo com a janela de 24h fechada.
  const inputDisabled = noteMode ? loading : disabled || loading;

  useEffect(() => {
    setIncludeSenderName(readIncludeSenderNamePreference());
  }, []);

  useEffect(() => {
    if (replyingTo) {
      setMode("message");
      textareaRef.current?.focus();
    }
  }, [replyingTo]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [body]);

  function handleIncludeSenderNameChange(enabled: boolean) {
    setIncludeSenderName(enabled);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(INCLUDE_SENDER_NAME_KEY, enabled ? "1" : "0");
    }
  }

  const sendOptions: SendMessageOptions = { includeSenderName };

  async function submitText(text?: string) {
    const value = (text ?? body).trim();
    if (!value || inputDisabled) return;
    setLoading(true);
    try {
      if (noteMode && onSendNote) {
        await onSendNote(value);
      } else {
        await onSendText(value, sendOptions);
      }
      setBody("");
    } catch {
      // Falha já exibida via sendError; mantém o texto digitado no composer.
    } finally {
      setLoading(false);
    }
  }

  async function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await submitText();
    }
  }

  async function handleSendAudio(blob: Blob, mimeType: string) {
    if (disabled || loading) return;
    setLoading(true);
    try {
      const ext = mimeType.includes("ogg")
        ? "ogg"
        : mimeType.includes("mp4")
          ? "m4a"
          : "webm";
      const file = new File([blob], `audio-${Date.now()}.${ext}`, { type: mimeType });
      await onSendMedia({ file, type: "audio" }, sendOptions);
    } finally {
      setLoading(false);
    }
  }

  async function handlePickImage(file: File) {
    if (disabled || loading) return;
    setLoading(true);
    try {
      await onSendMedia({ file, type: "image" }, sendOptions);
    } finally {
      setLoading(false);
    }
  }

  async function handlePickDocument(file: File) {
    if (disabled || loading) return;
    setLoading(true);
    try {
      await onSendMedia({ file, type: "document" }, sendOptions);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`chat-composer-shell rounded-2xl px-3 py-2 ${
        noteMode ? "ring-1 ring-amber-500/40" : ""
      }`}
    >
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {onSendNote && (
            <div className="flex shrink-0 rounded-lg border border-app-border p-0.5">
              <button
                type="button"
                onClick={() => setMode("message")}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[0.6875rem] font-medium transition-colors ${
                  !noteMode
                    ? "bg-app-accent text-white"
                    : "text-app-muted hover:text-app-text"
                }`}
              >
                <MessageSquare className="h-3 w-3" />
                Mensagem
              </button>
              <button
                type="button"
                onClick={() => setMode("note")}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[0.6875rem] font-medium transition-colors ${
                  noteMode
                    ? "bg-amber-500/80 text-white"
                    : "text-app-muted hover:text-app-text"
                }`}
              >
                <StickyNote className="h-3 w-3" />
                Nota
              </button>
            </div>
          )}
          <ConnectionSwitcher
            conversation={conversation}
            onConversationUpdated={onConversationUpdated}
            connections={connections}
            placement="composer"
          />
        </div>
        <Switch
          checked={includeSenderName}
          onChange={handleIncludeSenderNameChange}
          label="Assinar com nome"
          title="Inclui seu nome de usuário na mensagem enviada ao contato no WhatsApp"
          labelClassName="shrink-0 whitespace-nowrap"
        />
      </div>

      {replyingTo && !noteMode && (
        <div className="mb-2 flex items-start justify-between gap-2 rounded-lg border-l-2 border-app-accent bg-app-secondary/40 px-3 py-1.5">
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-medium text-app-accent">
              Respondendo{" "}
              {replyingTo.direction === "inbound"
                ? contactName || "contato"
                : replyingTo.sentByName || "você"}
            </p>
            <p className="truncate chat-text-meta text-app-subtle">
              {replyingTo.body || replyingTo.media?.caption || `[${replyingTo.type}]`}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="shrink-0 rounded p-0.5 text-app-muted hover:text-app-text"
            aria-label="Cancelar resposta"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {noteMode && (
        <p className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 chat-text-meta text-amber-200">
          Nota interna — visível só para a equipe, não é enviada ao contato.
        </p>
      )}

      {disabled && !noteMode && disabledReason && (
        <p className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 chat-text-meta text-amber-200">
          {disabledReason}
        </p>
      )}

      {sendError && (
        <div className="mb-2 flex items-start justify-between gap-2 rounded-lg border border-red-500/35 bg-red-500/12 px-3 py-2">
          <p className="chat-text-meta text-red-200">{sendError}</p>
          {onDismissError && (
            <button
              type="button"
              onClick={onDismissError}
              className="shrink-0 text-xs text-red-300/80 hover:text-red-200"
            >
              Fechar
            </button>
          )}
        </div>
      )}

      <div
        className={`flex min-w-0 gap-1 ${isRecordingUi ? "w-full items-center" : "items-end"}`}
      >
        {!isRecordingUi && (
          <>
            <div className="flex shrink-0 items-center">
              {!noteMode && (
                <>
                  <AttachmentMenu
                    disabled={inputDisabled}
                    onPickImage={handlePickImage}
                    onPickDocument={handlePickDocument}
                  />
                  <QuickReplyPicker
                    contactName={contactName}
                    contactPhone={contactPhone}
                    slashQuery={slashQuery}
                    onInsert={(text) => setBody(text)}
                    onSend={submitText}
                  />
                </>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={inputDisabled}
                rows={1}
                placeholder={
                  noteMode
                    ? "Escreva uma nota interna para a equipe"
                    : disabled
                      ? "Janela de atendimento fechada"
                      : "Digite uma mensagem ou /atalho"
                }
                className="block max-h-[120px] min-h-[40px] w-full resize-none overflow-y-auto bg-transparent px-2 py-2 outline-none disabled:opacity-50"
                style={{ fontSize: "var(--chat-text)" }}
              />
            </div>
          </>
        )}

        <div className="shrink-0">
          {noteMode ? (
            <button
              type="button"
              disabled={inputDisabled || !body.trim()}
              onClick={() => submitText()}
              className="rounded-xl bg-amber-500/80 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
            >
              Salvar nota
            </button>
          ) : (
            <AudioRecordingBar
              disabled={inputDisabled}
              hasText={!isRecordingUi && Boolean(body.trim())}
              recorder={audioRecorder}
              onSendText={() => submitText()}
              onSendAudio={handleSendAudio}
            />
          )}
        </div>
      </div>

      <input type="hidden" name="conversationId" value={conversationId} readOnly />
    </div>
  );
}
