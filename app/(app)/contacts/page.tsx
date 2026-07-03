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
import type { Contact, ContactList, ContactOrigin, ContactOriginField } from "@/lib/types";

function formatOriginFieldValue(value: string, field: ContactOriginField): string {
  if (field.type === "month" && value.includes("-")) {
    const [year, month] = value.split("-");
    if (year && month) return `${month}/${year}`;
  }
  return value;
}

export default function ContactsPage() {
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [origins, setOrigins] = useState<ContactOrigin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [activeOriginTab, setActiveOriginTab] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTags, setEditTags] = useState("");
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [loadError, setLoadError] = useState("");

  async function loadContacts(): Promise<{
    contacts: Contact[];
    lists: ContactList[];
    origins: ContactOrigin[];
  }> {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (tagFilter) params.set("tag", tagFilter);

    const [contactsRes, listsRes, originsRes] = await Promise.all([
      apiFetch(`/api/contacts?${params}`),
      apiFetch("/api/contact-lists"),
      apiFetch("/api/contact-origins"),
    ]);

    const contactData = await parseApiJson<{ contacts?: Contact[]; error?: string }>(
      contactsRes
    );
    const listData = await parseApiJson<{ lists?: ContactList[]; error?: string }>(
      listsRes
    );
    const originData = await parseApiJson<{ origins?: ContactOrigin[]; error?: string }>(
      originsRes
    );

    if (!contactsRes.ok) {
      throw new Error(contactData.error || "Erro ao carregar contatos.");
    }

    if (!listsRes.ok) {
      console.warn("[contacts] listas:", listData.error || listsRes.status);
    }

    return {
      contacts: contactData.contacts || [],
      lists: listsRes.ok ? listData.lists || [] : [],
      origins: originsRes.ok ? originData.origins || [] : [],
    };
  }

  function applyContacts(data: {
    contacts: Contact[];
    lists: ContactList[];
    origins: ContactOrigin[];
  }) {
    setAllContacts(data.contacts);
    setLists(data.lists);
    setOrigins(data.origins);
    setLoadError("");
  }

  const activeOrigin = useMemo(
    () => origins.find((o) => o.id === activeOriginTab) ?? null,
    [origins, activeOriginTab]
  );

  const contacts = useMemo(() => {
    if (activeOriginTab === "all") return allContacts;
    return allContacts.filter((c) => c.originId === activeOriginTab);
  }, [allContacts, activeOriginTab]);

  const originCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allContacts.length };
    for (const origin of origins) {
      counts[origin.id] = allContacts.filter((c) => c.originId === origin.id).length;
    }
    return counts;
  }, [allContacts, origins]);

  const tableOriginFields = useMemo(() => {
    if (activeOriginTab === "all") return [];
    return activeOrigin?.fields ?? [];
  }, [activeOriginTab, activeOrigin]);

  function originLabel(contact: Contact): string {
    if (!contact.originId) return contact.source || "—";
    const origin = origins.find((o) => o.id === contact.originId || o.key === contact.originId);
    return origin?.label || contact.originId;
  }

  function matchesFilters(contact: Contact): boolean {
    if (activeOriginTab !== "all" && contact.originId !== activeOriginTab) return false;
    if (tagFilter && !contact.tags?.includes(tagFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      const hit =
        contact.name.toLowerCase().includes(q) ||
        contact.phone.includes(q) ||
        contact.tags?.some((t) => t.toLowerCase().includes(q));
      if (!hit) return false;
    }
    return true;
  }

  function reloadContacts(created?: Contact) {
    if (created && matchesFilters(created)) {
      setAllContacts((prev) => {
        const exists = prev.some((c) => c.id === created.id);
        if (exists) return prev;
        return [created, ...prev];
      });
    }

    setLoading(true);
    loadContacts()
      .then(applyContacts)
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Erro ao carregar contatos.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let active = true;
    loadContacts()
      .then((data) => {
        if (active) applyContacts(data);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when filters change
  }, [search, tagFilter]);

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
      setAllContacts((prev) => prev.filter((c) => c.id !== contact.id));
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Erro ao excluir contato.", {
        title: "Erro",
        variant: "error",
      });
    } finally {
      setDeletingId(null);
    }
  }

  const allTags = [...new Set(allContacts.flatMap((c) => c.tags || []))];

  const tabLabel =
    activeOriginTab === "all"
      ? "Todos"
      : `${activeOrigin?.label ?? "Origem"} (${originCounts[activeOriginTab] ?? 0})`;

  return (
    <AppShell title="Contatos" subtitle="Gerencie leads por origem, tags e importação Excel">
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <ContactForm
            onCreated={reloadContacts}
            defaultOriginId={activeOriginTab !== "all" ? activeOriginTab : undefined}
          />
          <ContactImport onImported={reloadContacts} />
        </div>

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
          </div>

          <div className="mb-4 flex flex-wrap gap-3">
            <Input
              id="search"
              label="Buscar"
              value={search}
              onChange={(e) => {
                setLoading(true);
                setSearch(e.target.value);
              }}
              placeholder="Nome, telefone ou tag"
              className="min-w-[200px] flex-1"
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-app-subtle">
                Filtrar por tag
              </label>
              <Select
                value={tagFilter}
                onChange={(e) => {
                  setLoading(true);
                  setTagFilter(e.target.value);
                }}
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
            {tabLabel} — {contacts.length} contato(s)
          </h3>
          {loadError && (
            <p className="mb-3 text-sm text-red-400">{loadError}</p>
          )}
          {loading ? (
            <p className="text-app-subtle">Carregando...</p>
          ) : contacts.length === 0 ? (
            <p className="text-app-subtle">
              {activeOriginTab === "all"
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
                        <Badge
                          tone={contact.optIn ? "success" : "neutral"}
                          title="Autorização para receber campanhas e mensagens proativas"
                        >
                          {contact.optIn ? "Autorizado" : "Não autorizado"}
                        </Badge>
                      </td>
                      <td className="py-3">
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
                            variant="danger"
                            loading={deletingId === contact.id}
                            onClick={() => handleDelete(contact)}
                          >
                            Excluir
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
