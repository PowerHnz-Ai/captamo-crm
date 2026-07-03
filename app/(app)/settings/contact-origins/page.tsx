"use client";

import { useEffect, useState } from "react";
import { Pencil, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { appAlert } from "@/lib/app-dialog";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import type { ContactOrigin, ContactOriginField } from "@/lib/types";

const EMPTY_FIELD_DRAFT = {
  key: "",
  label: "",
  type: "text" as ContactOriginField["type"],
  required: false,
};

function OriginFieldsEditor({
  fields,
  onChange,
  idPrefix,
}: {
  fields: ContactOriginField[];
  onChange: (fields: ContactOriginField[]) => void;
  idPrefix: string;
}) {
  const [fieldDraft, setFieldDraft] = useState(EMPTY_FIELD_DRAFT);

  function addField() {
    if (!fieldDraft.key.trim() || !fieldDraft.label.trim()) return;
    onChange([
      ...fields,
      {
        key: fieldDraft.key.trim(),
        label: fieldDraft.label.trim(),
        type: fieldDraft.type,
        required: fieldDraft.required,
      },
    ]);
    setFieldDraft(EMPTY_FIELD_DRAFT);
  }

  function removeField(key: string) {
    onChange(fields.filter((f) => f.key !== key));
  }

  return (
    <div className="rounded-xl border border-app-border bg-app-secondary/20 p-3">
      <p className="mb-2 text-sm font-medium text-app-subtle">Campos</p>
      <div className="grid gap-2 md:grid-cols-2">
        <Input
          id={`${idPrefix}-field-key`}
          label="Chave do campo"
          value={fieldDraft.key}
          onChange={(e) => setFieldDraft({ ...fieldDraft, key: e.target.value })}
        />
        <Input
          id={`${idPrefix}-field-label`}
          label="Rótulo"
          value={fieldDraft.label}
          onChange={(e) => setFieldDraft({ ...fieldDraft, label: e.target.value })}
        />
        <Select
          id={`${idPrefix}-field-type`}
          label="Tipo"
          value={fieldDraft.type}
          onChange={(e) =>
            setFieldDraft({
              ...fieldDraft,
              type: e.target.value as ContactOriginField["type"],
            })
          }
        >
          <option value="text">Texto</option>
          <option value="month">Mês</option>
          <option value="phone">Telefone</option>
          <option value="contact_ref">Contato referência</option>
        </Select>
        <Checkbox
          label="Obrigatório"
          checked={fieldDraft.required}
          onChange={(required) => setFieldDraft({ ...fieldDraft, required })}
          labelClassName="items-end pb-2 text-sm text-app-subtle"
        />
      </div>
      <Button type="button" variant="secondary" className="mt-2" onClick={addField}>
        Adicionar campo
      </Button>
      {fields.length > 0 && (
        <ul className="mt-3 space-y-2">
          {fields.map((field) => (
            <li
              key={field.key}
              className="flex items-center justify-between rounded-lg border border-app-border/60 bg-app-secondary/30 px-3 py-2 text-xs text-app-muted"
            >
              <span>
                {field.label} <span className="text-app-subtle">({field.type})</span>
              </span>
              <button
                type="button"
                onClick={() => removeField(field.key)}
                className="rounded p-1 text-app-muted hover:bg-white/5 hover:text-red-400"
                aria-label={`Remover ${field.label}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ContactOriginsSettingsPage() {
  const [origins, setOrigins] = useState<ContactOrigin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingOriginId, setEditingOriginId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<ContactOriginField[]>([]);
  const [form, setForm] = useState({
    key: "",
    label: "",
    fields: [] as ContactOriginField[],
  });

  function load() {
    setLoading(true);
    apiFetch("/api/contact-origins")
      .then((res) => parseApiJson<{ origins?: ContactOrigin[]; error?: string }>(res))
      .then((data) => {
        if (!data.origins) throw new Error(data.error || "Erro ao carregar origens.");
        setOrigins(data.origins);
        setError("");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Erro ao carregar.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(origin: ContactOrigin) {
    setEditingOriginId(origin.id);
    setEditFields([...origin.fields]);
  }

  function cancelEdit() {
    setEditingOriginId(null);
    setEditFields([]);
  }

  async function saveOriginFields(originId: string) {
    setSaving(true);
    try {
      const res = await apiFetch("/api/contact-origins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: originId, fields: editFields }),
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao salvar origem.");
      cancelEdit();
      load();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Erro", {
        title: "Erro",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function createOrigin(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch("/api/contact-origins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao criar origem.");
      setForm({ key: "", label: "", fields: [] });
      load();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Erro", {
        title: "Erro",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="Origens de contato"
      subtitle="Configure campos por origem para cadastro, importação e campanhas"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Card hover={false}>
          <h3 className="mb-4 font-display text-lg font-semibold">Origens existentes</h3>
          {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
          {loading ? (
            <p className="text-app-subtle">Carregando...</p>
          ) : (
            <ul className="space-y-3">
              {origins.map((origin) => (
                <li
                  key={origin.id}
                  className="rounded-xl border border-app-border bg-app-secondary/30 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {origin.label}{" "}
                        <span className="text-xs text-app-muted">({origin.key})</span>
                      </p>
                      {origin.isSystem && (
                        <p className="mt-1 text-xs text-app-muted">Origem do sistema</p>
                      )}
                      {origin.key === "custom" && origin.fields.length === 0 && (
                        <p className="mt-1 text-xs text-amber-400">
                          Personalizado sem campos — adicione variáveis abaixo.
                        </p>
                      )}
                    </div>
                    {editingOriginId !== origin.id && (
                      <button
                        type="button"
                        onClick={() => startEdit(origin)}
                        className="rounded-lg p-2 text-app-muted hover:bg-white/5 hover:text-app-text"
                        title="Editar campos"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {editingOriginId === origin.id ? (
                    <div className="mt-3 space-y-3">
                      <OriginFieldsEditor
                        fields={editFields}
                        onChange={setEditFields}
                        idPrefix={`edit-${origin.id}`}
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          loading={saving}
                          onClick={() => saveOriginFields(origin.id)}
                        >
                          Salvar campos
                        </Button>
                        <Button type="button" variant="secondary" onClick={cancelEdit}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    origin.fields.length > 0 && (
                      <p className="mt-2 text-xs text-app-subtle">
                        Campos: {origin.fields.map((f) => f.label).join(", ")}
                      </p>
                    )
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card hover={false}>
          <h3 className="mb-4 font-display text-lg font-semibold">Nova origem custom</h3>
          <form onSubmit={createOrigin} className="space-y-3">
            <Input
              id="origin-key"
              label="Chave (slug)"
              value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
              placeholder="parceiros"
              required
            />
            <Input
              id="origin-label"
              label="Nome exibido"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Parceiros"
              required
            />

            <OriginFieldsEditor
              fields={form.fields}
              onChange={(fields) => setForm((prev) => ({ ...prev, fields }))}
              idPrefix="create"
            />

            <Button type="submit" loading={saving}>
              Criar origem
            </Button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
