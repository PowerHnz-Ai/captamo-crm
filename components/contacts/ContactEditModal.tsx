"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ContactOriginFields } from "@/components/contacts/ContactOriginFields";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import { LEAD_CLASSES } from "@/lib/lead-class";
import type { Contact, ContactOrigin } from "@/lib/types";

interface ContactEditModalProps {
  contact: Contact;
  origins: ContactOrigin[];
  onClose: () => void;
  onSaved: () => void;
}

export function ContactEditModal({
  contact,
  origins,
  onClose,
  onSaved,
}: ContactEditModalProps) {
  const [name, setName] = useState(contact.name || "");
  const [phone, setPhone] = useState(contact.phone || "");
  const [originId, setOriginId] = useState(contact.originId || "");
  const [originFields, setOriginFields] = useState<Record<string, string>>(
    contact.originFields ?? {}
  );
  const [optIn, setOptIn] = useState(contact.optIn ?? true);
  const [tags, setTags] = useState((contact.tags || []).join(", "));
  const [leadClass, setLeadClass] = useState(
    contact.leadClass != null ? String(contact.leadClass) : ""
  );
  const [notes, setNotes] = useState(contact.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const initialOriginIdRef = useRef(contact.originId || "");

  const selectedOrigin = origins.find((o) => o.id === originId);

  useEffect(() => {
    if (originId === initialOriginIdRef.current) return;
    setOriginFields({});
  }, [originId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch("/api/contacts", {
        method: "PATCH",
        body: JSON.stringify({
          id: contact.id,
          name: name.trim(),
          phone: phone.trim(),
          optIn,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          notes: notes.trim() || undefined,
          leadClass: leadClass ? Number(leadClass) : null,
          originId: originId || undefined,
          originFields: Object.keys(originFields).length ? originFields : undefined,
          source: selectedOrigin?.key || contact.source,
        }),
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao salvar contato.");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar contato.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Fechar"
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-app-border bg-app-card p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Editar contato</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-app-muted hover:bg-white/5 hover:text-app-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="grid gap-3">
          <Input
            id="edit-name"
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            id="edit-phone"
            label="Telefone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="5522999999999"
            required
          />
          {origins.length > 0 && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-app-subtle">
                Origem
              </label>
              <Select value={originId} onChange={(e) => setOriginId(e.target.value)}>
                <option value="">Sem origem</option>
                {origins.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <ContactOriginFields
            origin={selectedOrigin}
            values={originFields}
            onChange={setOriginFields}
            disabled={saving}
            idPrefix="edit-origin"
          />
          <Input
            id="edit-tags"
            label="Tags (separadas por vírgula)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="lead, vip"
          />
          <Select
            id="edit-lead-class"
            label="Classe do lead"
            value={leadClass}
            onChange={(e) => setLeadClass(e.target.value)}
          >
            <option value="">Sem classe</option>
            {LEAD_CLASSES.map((item) => (
              <option key={item.value} value={String(item.value)}>
                {item.label} — {item.description}
              </option>
            ))}
          </Select>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-app-subtle">
              Notas
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-app-border bg-app-secondary px-3 py-2 text-[0.9375rem] text-app-text outline-none transition-colors placeholder:text-app-muted focus:border-app-accent focus:ring-2 focus:ring-app-accent/30"
              placeholder="Observações internas"
            />
          </div>
          <Checkbox
            label="Autoriza receber campanhas"
            title="Consentimento para campanhas e mensagens proativas. Inativo: excluído de campanhas, mas pode receber resposta na janela de 24h se enviar mensagem."
            checked={optIn}
            onChange={setOptIn}
            labelClassName="text-sm text-app-subtle"
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              Salvar alterações
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
