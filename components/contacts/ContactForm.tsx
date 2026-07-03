"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { ContactOriginFields } from "@/components/contacts/ContactOriginFields";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import type { Contact, ContactOrigin } from "@/lib/types";

interface ContactFormProps {
  onCreated: (contact?: Contact) => void;
  defaultOriginId?: string;
}

export function ContactForm({ onCreated, defaultOriginId }: ContactFormProps) {
  const [origins, setOrigins] = useState<ContactOrigin[]>([]);
  const [originId, setOriginId] = useState("");
  const [originFields, setOriginFields] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [optIn, setOptIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedOrigin = origins.find((o) => o.id === originId);

  useEffect(() => {
    apiFetch("/api/contact-origins")
      .then((res) => res.json())
      .then((data) => {
        const items = (data.origins || []) as ContactOrigin[];
        setOrigins(items);
        if (defaultOriginId && items.some((o) => o.id === defaultOriginId)) {
          setOriginId(defaultOriginId);
        } else if (items[0]) {
          setOriginId(items[0].id);
        }
      })
      .catch(() => setOrigins([]));
  }, [defaultOriginId]);

  useEffect(() => {
    if (defaultOriginId && origins.some((o) => o.id === defaultOriginId)) {
      setOriginId(defaultOriginId);
    }
  }, [defaultOriginId, origins]);

  useEffect(() => {
    setOriginFields({});
  }, [originId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await apiFetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          source: selectedOrigin?.key || "manual",
          tags: ["lead"],
          optIn,
          originId: originId || undefined,
          originFields: Object.keys(originFields).length ? originFields : undefined,
        }),
      });

      const data = await parseApiJson<{ contact?: Contact; error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao criar contato");

      setName("");
      setPhone("");
      setOriginFields({});
      onCreated(data.contact as Contact | undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <h3 className="mb-4 font-display text-lg font-semibold">Novo contato</h3>
      <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <Select
            id="contact-origin"
            label="Origem"
            value={originId}
            onChange={(e) => setOriginId(e.target.value)}
          >
            {origins.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        <Input
          id="contact-name"
          label="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          id="contact-phone"
          label="Telefone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="5522999999999"
          required
        />

        <ContactOriginFields
          origin={selectedOrigin}
          values={originFields}
          onChange={setOriginFields}
          disabled={loading}
        />

        <Checkbox
          className="self-end pb-2"
          label="Autoriza receber campanhas"
          title="Consentimento para receber campanhas e mensagens proativas (templates fora da janela de 24h). Desativado: ainda pode receber respostas se iniciar conversa."
          checked={optIn}
          onChange={setOptIn}
          labelClassName="text-sm text-app-subtle"
        />
        {error && <p className="text-sm text-red-400 md:col-span-2">{error}</p>}
        <div className="md:col-span-2">
          <Button type="submit" loading={loading}>
            Salvar contato
          </Button>
        </div>
      </form>
    </Card>
  );
}
