"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import {
  CampaignParameterMapper,
  defaultParameterValues,
  parameterValuesToMapping,
  type ParameterMappingValue,
} from "@/components/campaigns/CampaignParameterMapper";
import {
  buildHeaderImageMappingOptions,
  CampaignHeaderImageSection,
  type HeaderImageMode,
} from "@/components/campaigns/CampaignHeaderImageSection";
import type { MediaLibrarySelection } from "@/components/media/MediaLibraryPicker";
import { appAlert } from "@/lib/app-dialog";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import {
  countTemplateVariables,
  renderTemplateBody,
  templateHasImageHeader,
} from "@/lib/campaign-params";
import {
  originFieldOptionsForOrigin,
  suggestParameterValuesForOrigin,
} from "@/lib/campaign-origin-defaults";
import type { Contact, ContactOrigin, Template } from "@/lib/types";

export interface TemplateSendPayload {
  templateName: string;
  language: string;
  parameters: string[];
  parameterMapping?: string[];
  headerImageStoragePath?: string;
  headerImageAssetId?: string;
  headerImageMode?: HeaderImageMode;
  headerImageMapping?: string;
}

interface TemplatePanelProps {
  contact: Contact | null;
  contactName?: string;
  contactPhone?: string;
  onSend: (data: TemplateSendPayload) => Promise<void>;
}

function buildFallbackContact(name: string, phone: string): Contact {
  return {
    id: "chat-template",
    name,
    phone,
    source: "whatsapp",
    tags: [],
    optIn: true,
    blocked: false,
    createdAt: {} as Contact["createdAt"],
    updatedAt: {} as Contact["updatedAt"],
  };
}

function validateParamValues(values: ParameterMappingValue[]): string | null {
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (v.type === "literal" && !v.value.trim()) {
      return `Preencha o texto fixo da variável {{${i + 1}}}.`;
    }
  }
  return null;
}

export function TemplatePanel({
  contact,
  contactName = "",
  contactPhone = "",
  onSend,
}: TemplatePanelProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [paramValues, setParamValues] = useState<ParameterMappingValue[]>([]);
  const [sending, setSending] = useState(false);
  const [origins, setOrigins] = useState<ContactOrigin[]>([]);
  const [headerImageMode, setHeaderImageMode] = useState<HeaderImageMode>("fixed");
  const [headerImageSelection, setHeaderImageSelection] =
    useState<MediaLibrarySelection | null>(null);
  const [headerImageMapping, setHeaderImageMapping] = useState("");
  const [libraryAssets, setLibraryAssets] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [resolvedParameters, setResolvedParameters] = useState<string[]>([]);
  const [resolvingPreview, setResolvingPreview] = useState(false);

  const effectiveContact = useMemo(
    () =>
      contact ||
      buildFallbackContact(contactName || contactPhone, contactPhone),
    [contact, contactName, contactPhone]
  );

  useEffect(() => {
    apiFetch("/api/templates")
      .then((res) => parseApiJson<{ templates?: Template[] }>(res))
      .then((data) => {
        const approved = (data.templates || []).filter(
          (t) => t.status === "approved"
        );
        setTemplates(approved);
        if (approved[0]) setSelectedId(approved[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    apiFetch("/api/contact-origins")
      .then((res) => parseApiJson<{ origins?: ContactOrigin[] }>(res))
      .then((data) => setOrigins(data.origins || []))
      .catch(() => setOrigins([]));
  }, []);

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) || null,
    [templates, selectedId]
  );

  const contactOrigin = useMemo(
    () => origins.find((o) => o.id === effectiveContact.originId) ?? null,
    [origins, effectiveContact.originId]
  );

  const originFieldOptions = useMemo(
    () => originFieldOptionsForOrigin(contactOrigin),
    [contactOrigin]
  );

  const templateVarCount = selected ? countTemplateVariables(selected.body) : 0;
  const showHeaderImage = templateHasImageHeader(selected?.header);

  useEffect(() => {
    if (!showHeaderImage) return;
    apiFetch("/api/media-library")
      .then((res) => parseApiJson<{ assets?: Array<{ id: string; name: string }> }>(res))
      .then((data) => setLibraryAssets(data.assets || []))
      .catch(() => setLibraryAssets([]));
  }, [showHeaderImage]);

  useEffect(() => {
    if (!selected) return;
    const count = countTemplateVariables(selected.body);
    if (count === 0) {
      setParamValues([]);
      return;
    }
    if (contactOrigin) {
      setParamValues(suggestParameterValuesForOrigin(contactOrigin, count));
    } else {
      setParamValues(defaultParameterValues(count));
    }
  }, [selected?.id, contactOrigin?.id]);

  const headerMappingOptions = useMemo(
    () =>
      buildHeaderImageMappingOptions({
        originFieldOptions,
        columnOptions: [],
        assets: libraryAssets,
      }),
    [originFieldOptions, libraryAssets]
  );

  const mapping = useMemo(
    () => parameterValuesToMapping(paramValues),
    [paramValues]
  );

  useEffect(() => {
    if (!selected || mapping.length === 0 || !contactPhone) {
      setResolvedParameters([]);
      return;
    }

    let active = true;
    setResolvingPreview(true);

    apiFetch("/api/whatsapp/resolve-template-params", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: contactPhone,
        parameterMapping: mapping,
      }),
    })
      .then((res) =>
        parseApiJson<{ parameters?: string[]; error?: string }>(res)
      )
      .then((data) => {
        if (!active) return;
        if (data.parameters) {
          setResolvedParameters(data.parameters);
        }
      })
      .catch(() => {
        if (active) setResolvedParameters([]);
      })
      .finally(() => {
        if (active) setResolvingPreview(false);
      });

    return () => {
      active = false;
    };
  }, [selected?.id, contactPhone, mapping, contact?.id]);

  const previewText = useMemo(() => {
    if (!selected) return "";
    return renderTemplateBody(selected.body, resolvedParameters);
  }, [selected, resolvedParameters]);

  const emptyOriginWarnings = useMemo(() => {
    const warnings: string[] = [];
    for (const value of paramValues) {
      if (value.type === "origin") {
        const raw = effectiveContact.originFields?.[value.key]?.trim();
        if (!raw) warnings.push(value.label);
      }
    }
    if (
      showHeaderImage &&
      headerImageMode === "per_contact" &&
      headerImageMapping.startsWith("origin:")
    ) {
      const key = headerImageMapping.slice("origin:".length);
      const label =
        originFieldOptions.find((f) => f.key === key)?.label || key;
      const raw = effectiveContact.originFields?.[key]?.trim();
      if (!raw) warnings.push(label);
    }
    return [...new Set(warnings)];
  }, [
    paramValues,
    effectiveContact.originFields,
    showHeaderImage,
    headerImageMode,
    headerImageMapping,
    originFieldOptions,
  ]);

  function buildHeaderPayload(): Pick<
    TemplateSendPayload,
    | "headerImageStoragePath"
    | "headerImageAssetId"
    | "headerImageMode"
    | "headerImageMapping"
  > {
    if (!showHeaderImage) return {};
    if (headerImageMode === "per_contact" && headerImageMapping) {
      return {
        headerImageMode: "per_contact",
        headerImageMapping,
      };
    }
    if (headerImageSelection) {
      return {
        headerImageMode: "fixed",
        headerImageAssetId: headerImageSelection.assetId,
        headerImageStoragePath: headerImageSelection.storagePath,
      };
    }
    return {};
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;

    const paramError = validateParamValues(paramValues);
    if (paramError) {
      await appAlert(paramError, { title: "Variáveis incompletas", variant: "warning" });
      return;
    }

    if (showHeaderImage) {
      if (headerImageMode === "fixed" && !headerImageSelection) {
        await appAlert("Selecione uma imagem para o cabeçalho do template.", {
          title: "Imagem obrigatória",
          variant: "warning",
        });
        return;
      }
      if (headerImageMode === "per_contact" && !headerImageMapping) {
        await appAlert("Defina o campo de origem da imagem do cabeçalho.", {
          title: "Imagem obrigatória",
          variant: "warning",
        });
        return;
      }
    }

    if (emptyOriginWarnings.length > 0) {
      await appAlert(
        `Preencha no perfil do contato: ${emptyOriginWarnings.join(", ")}.`,
        { title: "Campos de origem vazios", variant: "warning" }
      );
      return;
    }

    if (
      templateVarCount > 0 &&
      resolvedParameters.some((value) => !value.trim())
    ) {
      await appAlert(
        "Uma ou mais variáveis estão vazias após resolver os campos do contato. Ajuste o mapeamento ou preencha os dados do contato.",
        { title: "Variáveis incompletas", variant: "warning" }
      );
      return;
    }

    setSending(true);
    try {
      await onSend({
        templateName: selected.name,
        language: selected.language,
        parameters: resolvedParameters,
        parameterMapping: mapping,
        ...buildHeaderPayload(),
      });
    } catch (err) {
      await appAlert(
        err instanceof Error ? err.message : "Falha ao enviar template.",
        { title: "Erro ao enviar", variant: "error" }
      );
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-app-subtle">Carregando templates...</p>;
  }

  if (templates.length === 0) {
    return (
      <p className="text-sm text-app-subtle">
        Nenhum template aprovado. Crie e sincronize em Templates.
      </p>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <h3 className="shrink-0 text-sm font-semibold">Enviar template</h3>

      <form onSubmit={handleSubmit} className="mt-3 flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          <div className="rounded-xl border border-app-border bg-app-secondary/30 p-3">
            <label className="block text-xs font-medium text-app-subtle">
              Template
              <Select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="mt-1"
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.language})
                  </option>
                ))}
              </Select>
            </label>
            {selected && (
              <p className="mt-2 rounded-lg bg-black/20 p-2 text-xs text-app-subtle whitespace-pre-wrap">
                {selected.body}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-app-border bg-app-secondary/30 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-app-muted">
              Origem do contato
            </p>
            {contactOrigin ? (
              <div className="mt-2">
                <p className="text-sm font-medium text-app-text">{contactOrigin.label}</p>
                <p className="mt-1 text-xs text-app-muted">
                  Campos:{" "}
                  {contactOrigin.fields.map((f) => f.label).join(", ") || "—"}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-app-muted">
                Contato sem origem definida. Use primeiro nome, telefone ou texto fixo.
              </p>
            )}
          </div>

          {selected && templateVarCount > 0 ? (
            <CampaignParameterMapper
              template={selected}
              values={paramValues}
              onChange={setParamValues}
              columnOptions={[]}
              originFieldOptions={originFieldOptions}
            />
          ) : selected ? (
            <div className="rounded-xl border border-app-border bg-app-secondary/30 p-3">
              <p className="text-sm text-app-muted">
                Este template não possui variáveis.
              </p>
            </div>
          ) : null}

          {showHeaderImage && (
            <CampaignHeaderImageSection
              mode={headerImageMode}
              onModeChange={setHeaderImageMode}
              selection={headerImageSelection}
              onSelectionChange={setHeaderImageSelection}
              mapping={headerImageMapping}
              onMappingChange={setHeaderImageMapping}
              mappingOptions={headerMappingOptions}
              disabled={sending}
            />
          )}

          {selected && (
            <div className="rounded-xl border border-app-accent/30 bg-app-accent/5 p-3">
              <p className="mb-1 text-xs font-medium uppercase text-app-muted">
                Preview da mensagem
              </p>
              <p className="text-sm text-app-subtle whitespace-pre-wrap">
                {resolvingPreview ? "Atualizando preview..." : previewText}
              </p>
              {emptyOriginWarnings.length > 0 && (
                <p className="mt-2 text-xs text-amber-300/90">
                  Campo(s) não preenchido(s) no contato:{" "}
                  {emptyOriginWarnings.join(", ")}. Abra o perfil do contato para
                  preencher antes de enviar.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 pt-3">
          <Button
            type="submit"
            variant="whatsapp"
            loading={sending}
            disabled={emptyOriginWarnings.length > 0}
            className="w-full"
          >
            Enviar template
          </Button>
        </div>
      </form>
    </div>
  );
}
