"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ContactForm } from "@/components/contacts/ContactForm";
import { ContactEditModal } from "@/components/contacts/ContactEditModal";
import { ContactImport } from "@/components/contacts/ContactImport";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { appAlert, appConfirm } from "@/lib/app-dialog";
import { leadClassShortLabel } from "@/lib/lead-class";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import { usePermissions } from "@/hooks/usePermissions";
import type { Contact, ContactList, ContactOrigin, ContactOriginField } from "@/lib/types";

function formatOriginFieldValue(value: string, field: ContactOriginField): string {
  if (field.type === "month" && value.includes("-")) {
    const [year, month] = value.split("-");
    if (year && month) return `${month}/${year}`;
  }
  return value;
}

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 350;

/** Aba especial: lista de excluídos (LGPD) — contatos fora de qualquer disparo. */
const EXCLUDED_TAB = "__excluded__";

export default function ContactsPage() {
  const { can } = usePermissions();
  const canWrite = can("contacts.write");
  const canImport = can("contacts.import");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [allTags, setAllTags] = useState<string[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [origins, setOrigins] = useState<ContactOrigin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [activeOriginTab, setActiveOriginTab] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTags, setEditTags] = useState("");
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  async function loadPage(targetPage: number): Promise<{
    contacts: Contact[];
    total: number;
  }> {
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String((targetPage - 1) * PAGE_SIZE));
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (tagFilter) params.set("tag", tagFilter);
    if (activeOriginTab === EXCLUDED_TAB) {
      params.set("archived", "true");
    } else {
      params.set("archived", "false");
      if (activeOriginTab !== "all") params.set("originId", activeOriginTab);
    }

    const res = await apiFetch(`/api/contacts?${params}`);
    const data = await parseApiJson<{
      contacts?: Contact[];
      total?: number;
      error?: string;
    }>(res);
    if (!res.ok) throw new Error(data.error || "Erro ao carregar contatos.");
    return { contacts: data.contacts || [], total: data.total || 0 };
  }

  async function loadCounts() {
    try {
      const res = await apiFetch("/api/contacts/counts");
      const data = await parseApiJson<{
        counts?: Record<string, number>;
        tags?: string[];
        error?: string;
      }>(res);
      if (res.ok) {
        setCounts(data.counts || {});
        setAllTags(data.tags || []);
      }
    } catch {
      // contadores são informativos — não bloqueiam a tela
    }
  }

  async function loadListsAndOrigins() {
    const [listsRes, originsRes] = await Promise.all([
      apiFetch("/api/contact-lists"),
      apiFetch("/api/contact-origins"),
    ]);
    const listData = await parseApiJson<{ lists?: ContactList[]; error?: string }>(
      listsRes
    );
    const originData = await parseApiJson<{ origins?: ContactOrigin[]; error?: string }>(
      originsRes
    );
    if (!listsRes.ok) {
      console.warn("[contacts] listas:", listData.error || listsRes.status);
    }
    setLists(listsRes.ok ? listData.lists || [] : []);
    setOrigins(originsRes.ok ? originData.origins || [] : []);
  }

  const activeOrigin = useMemo(
    () => origins.find((o) => o.id === activeOriginTab) ?? null,
    [origins, activeOriginTab]
  );

  const originCounts = counts;

  const tableOriginFields = useMemo(() => {
    if (activeOriginTab === "all") return [];
    return activeOrigin?.fields ?? [];
  }, [activeOriginTab, activeOrigin]);

  function originLabel(contact: Contact): string {
    if (!contact.originId) return contact.source || "—";
    const origin = origins.find((o) => o.id === contact.originId || o.key === contact.originId);
    return origin?.label || contact.originId;
  }

  function reloadContacts() {
    setLoading(true);
    loadPage(page)
      .then((data) => {
        setContacts(data.contacts);
        setTotal(data.total);
        setLoadError("");
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Erro ao carregar contatos.");
      })
      .finally(() => setLoading(false));
    void loadCounts();
  }

  // Filtros mudaram → volta à primeira página.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, tagFilter, activeOriginTab]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadPage(page)
      .then((data) => {
        if (!active) return;
        setContacts(data.contacts);
        setTotal(data.total);
        setLoadError("");
      })
      .catch((err) => {
        if (active) {
          setLoadError(err instanceof Error ? err.message : "Erro ao carregar contatos.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when filters/page change
  }, [debouncedSearch, tagFilter, activeOriginTab, page]);

  useEffect(() => {
    void loadCounts();
    void loadListsAndOrigins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveTags(id: string) {
    const tags = editTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    await apiFetch("/api/contacts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, tags }),
    });
    setEditingId(null);
    reloadContacts();
  }

  async function patchContactFlags(
    contact: Contact,
    flags: { archived: boolean; blocked: boolean; optIn: boolean }
  ) {
    const res = await apiFetch("/api/contacts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: contact.id, ...flags }),
    });
    const data = await parseApiJson<{ error?: string }>(res);
    if (!res.ok) throw new Error(data.error || "Erro ao atualizar contato.");
  }

  /** LGPD: move para a lista de excluídos — fica registrado e nunca mais recebe disparo. */
  async function handleLgpdExclude(contact: Contact) {
    const confirmed = await appConfirm(
      `Mover "${contact.name || contact.phone}" para a lista de excluídos? O contato sai da lista e NUNCA mais recebe disparos — mesmo que apareça em uma nova importação (conformidade LGPD).`,
      {
        title: "Excluir da lista (LGPD)",
        destructive: true,
        confirmLabel: "Excluir da lista",
      }
    );
    if (!confirmed) return;
    try {
      await patchContactFlags(contact, { archived: true, blocked: true, optIn: false });
      reloadContacts();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Erro ao excluir da lista.", {
        title: "Erro",
        variant: "error",
      });
    }
  }

  async function handleRestore(contact: Contact) {
    const confirmed = await appConfirm(
      `Restaurar "${contact.name || contact.phone}"? Ele volta para a lista de contatos e poderá receber disparos novamente.`,
      { title: "Restaurar contato", confirmLabel: "Restaurar" }
    );
    if (!confirmed) return;
    try {
      await patchContactFlags(contact, { archived: false, blocked: false, optIn: true });
      reloadContacts();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Erro ao restaurar.", {
        title: "Erro",
        variant: "error",
      });
    }
  }

  async function handleDelete(contact: Contact) {
    const confirmed = await appConfirm(
      `Excluir o contato "${contact.name || contact.phone}"? Esta ação não pode ser desfeita.`,
      {
        title: "Excluir contato",
        destructive: true,
        confirmLabel: "Excluir",
      }
    );
    if (!confirmed) return;
    setDeletingId(contact.id);
    try {
      const res = await apiFetch(`/api/contacts?id=${contact.id}`, {
        method: "DELETE",
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao excluir contato.");
      reloadContacts();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Erro ao excluir contato.", {
        title: "Erro",
        variant: "error",
      });
    } finally {
      setDeletingId(null);
    }
  }

  const isExcludedTab = activeOriginTab === EXCLUDED_TAB;
  const tabLabel = isExcludedTab
    ? "Excluídos (LGPD)"
    : activeOriginTab === "all"
      ? "Todos"
      : `${activeOrigin?.label ?? "Origem"} (${originCounts[activeOriginTab] ?? 0})`;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(total, (page - 1) * PAGE_SIZE + contacts.length);

  return (
    <AppShell title="Contatos" subtitle="Gerencie leads por origem, tags e importação Excel">
      <div className="space-y-6">
        {(canWrite || canImport) && (
          <div className="grid gap-6 lg:grid-cols-2">
            {canWrite && (
              <ContactForm
                onCreated={reloadContacts}
                defaultOriginId={activeOriginTab !== "all" ? activeOriginTab : undefined}
              />
            )}
            {canImport && <ContactImport onImported={reloadContacts} />}
          </div>
        )}

        <Card hover={false}>
          <div className="mb-4 flex flex-wrap gap-2 border-b border-app-border pb-4">
            <button
              type="button"
              onClick={() => setActiveOriginTab("all")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeOriginTab === "all"
                  ? "bg-app-accent text-white"
                  : "bg-app-secondary/50 text-app-subtle hover:bg-app-secondary"
              }`}
            >
              Todos ({originCounts.all ?? 0})
            </button>
            {origins.map((origin) => (
              <button
                key={origin.id}
                type="button"
                onClick={() => setActiveOriginTab(origin.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeOriginTab === origin.id
                    ? "bg-app-accent text-white"
                    : "bg-app-secondary/50 text-app-subtle hover:bg-app-secondary"
                }`}
              >
                {origin.label} ({originCounts[origin.id] ?? 0})
              </button>
            ))}
            <button
              type="button"
              onClick={() => setActiveOriginTab(EXCLUDED_TAB)}
              title="Contatos excluídos da lista (LGPD) — nunca recebem disparos"
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                isExcludedTab
                  ? "bg-red-500/80 text-white"
                  : "bg-app-secondary/50 text-app-subtle hover:bg-app-secondary"
              }`}
            >
              Excluídos
            </button>
          </div>

          <div className="mb-4 flex flex-wrap gap-3">
            <Input
              id="search"
              label="Buscar"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome ou telefone"
              className="min-w-[200px] flex-1"
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-app-subtle">
                Filtrar por tag
              </label>
              <Select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
              >
                <option value="">Todas</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {lists.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {lists.map((list) => (
                <Badge key={list.id} tone="info">
                  {list.name}
                </Badge>
              ))}
            </div>
          )}

          <h3 className="mb-4 font-display text-lg font-semibold">
            {tabLabel} — {total} contato(s)
          </h3>
          {loadError && (
            <p className="mb-3 text-sm text-red-400">{loadError}</p>
          )}
          {loading ? (
            <p className="text-app-subtle">Carregando...</p>
          ) : contacts.length === 0 ? (
            <p className="text-app-subtle">
              {isExcludedTab
                ? "Nenhum contato excluído."
                : activeOriginTab === "all"
                  ? "Nenhum contato cadastrado ainda."
                  : "Nenhum contato nesta origem."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead>
                  <tr className="border-b border-app-border text-app-muted">
                    <th className="pb-3 pr-4 font-medium">Nome</th>
                    <th className="pb-3 pr-4 font-medium">Telefone</th>
                    <th className="pb-3 pr-4 font-medium">Tags</th>
                    <th className="pb-3 pr-4 font-medium">Classe</th>
                    {activeOriginTab === "all" && (
                      <th className="pb-3 pr-4 font-medium">Origem</th>
                    )}
                    {tableOriginFields.map((field) => (
                      <th key={field.key} className="pb-3 pr-4 font-medium">
                        {field.label}
                      </th>
                    ))}
                    <th className="pb-3 pr-4 font-medium" title="Consentimento para campanhas">
                      Campanhas
                    </th>
                    <th className="pb-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact) => (
                    <tr key={contact.id} className="border-b border-app-border/60">
                      <td className="py-3 pr-4 font-medium">{contact.name}</td>
                      <td className="py-3 pr-4 text-app-subtle">{contact.phone}</td>
                      <td className="py-3 pr-4">
                        {editingId === contact.id ? (
                          <div className="flex gap-2">
                            <input
                              value={editTags}
                              onChange={(e) => setEditTags(e.target.value)}
                              className="rounded border border-app-border bg-app-secondary/50 px-2 py-1 text-xs"
                              placeholder="tag1, tag2"
                            />
                            <Button onClick={() => saveTags(contact.id)}>
                              OK
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {(contact.tags || []).map((tag) => (
                              <Badge key={tag} tone="neutral">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {contact.leadClass ? (
                          <Badge tone="info" title={leadClassShortLabel(contact.leadClass)}>
                            {leadClassShortLabel(contact.leadClass)}
                          </Badge>
                        ) : (
                          <span className="text-app-muted">—</span>
                        )}
                      </td>
                      {activeOriginTab === "all" && (
                        <td className="py-3 pr-4 text-app-subtle">{originLabel(contact)}</td>
                      )}
                      {tableOriginFields.map((field) => (
                        <td key={field.key} className="py-3 pr-4 text-app-subtle">
                          {formatOriginFieldValue(
                            contact.originFields?.[field.key] || "—",
                            field
                          )}
                        </td>
                      ))}
                      <td className="py-3 pr-4">
                        {isExcludedTab ? (
                          <Badge tone="danger" title="Excluído da lista (LGPD) — não recebe disparos">
                            Excluído
                          </Badge>
                        ) : (
                          <Badge
                            tone={contact.optIn ? "success" : "neutral"}
                            title="Autorização para receber campanhas e mensagens proativas"
                          >
                            {contact.optIn ? "Autorizado" : "Não autorizado"}
                          </Badge>
                        )}
                      </td>
                      <td className="py-3">
                        {canWrite ? (
                          isExcludedTab ? (
                            <Button
                              variant="secondary"
                              onClick={() => handleRestore(contact)}
                            >
                              Restaurar
                            </Button>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="secondary"
                                onClick={() => setEditingContact(contact)}
                              >
                                Editar
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() => {
                                  setEditingId(contact.id);
                                  setEditTags((contact.tags || []).join(", "));
                                }}
                              >
                                Tags
                              </Button>
                              <Button
                                variant="ghost"
                                title="Excluir da lista (LGPD): sai da lista e nunca mais recebe disparos"
                                onClick={() => handleLgpdExclude(contact)}
                              >
                                LGPD
                              </Button>
                              <Button
                                variant="danger"
                                loading={deletingId === contact.id}
                                onClick={() => handleDelete(contact)}
                              >
                                Excluir
                              </Button>
                            </div>
                          )
                        ) : (
                          <span className="text-xs text-app-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && total > PAGE_SIZE && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-app-border pt-4">
              <p className="text-sm text-app-muted">
                Mostrando {pageStart}–{pageEnd} de {total} contato(s)
              </p>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <span className="px-2 text-sm text-app-subtle">
                  Página {page} de {totalPages}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {editingContact && (
        <ContactEditModal
          contact={editingContact}
          origins={origins}
          onClose={() => setEditingContact(null)}
          onSaved={() => reloadContacts()}
        />
      )}
    </AppShell>
  );
}
