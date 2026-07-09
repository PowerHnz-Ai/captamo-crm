"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import type {
  Template,
  TemplateButton,
  TemplateHeader,
  TemplateHeaderType,
} from "@/lib/types";
import { TemplateHeaderUploader } from "@/components/media/TemplateHeaderUploader";

interface TemplateBuilderProps {
  editing?: Template | null;
  onCreated: () => void;
  onCancelEdit?: () => void;
}

function extractVariables(body: string): number[] {
  const matches = body.match(/\{\{(\d+)\}\}/g) || [];
  return [...new Set(matches.map((m) => Number(m.replace(/\D/g, ""))))].sort(
    (a, b) => a - b
  );
}

function emptyFormState() {
  return {
    name: "",
    language: "pt_BR",
    category: "UTILITY" as "UTILITY" | "MARKETING" | "AUTHENTICATION",
    headerType: "NONE" as TemplateHeaderType,
    headerText: "",
    headerMedia: null as {
      storagePath: string;
      mediaAssetId: string;
      previewUrl?: string;
      name?: string;
    } | null,
    body: "",
    footer: "",
    variableSamples: [] as string[],
    buttons: [] as TemplateButton[],
  };
}

const HEADER_TYPES: TemplateHeaderType[] = ["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"];
const BUTTON_TYPES = ["QUICK_REPLY", "URL", "PHONE_NUMBER", "COPY_CODE"] as const;

export function TemplateBuilder({
  editing,
  onCreated,
  onCancelEdit,
}: TemplateBuilderProps) {
  const isEdit = Boolean(editing);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("pt_BR");
  const [category, setCategory] = useState<"UTILITY" | "MARKETING" | "AUTHENTICATION">(
    "UTILITY"
  );
  const [allowCategoryChange, setAllowCategoryChange] = useState(false);
  const [headerType, setHeaderType] = useState<TemplateHeaderType>("NONE");
  const [headerText, setHeaderText] = useState("");
  const [headerMedia, setHeaderMedia] = useState<{
    storagePath: string;
    mediaAssetId: string;
    previewUrl?: string;
    name?: string;
  } | null>(null);
  const [body, setBody] = useState("");
  const [footer, setFooter] = useState("");
  const [variableSamples, setVariableSamples] = useState<string[]>([]);
  const [buttons, setButtons] = useState<TemplateButton[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const bodyCursorRef = useRef({ start: 0, end: 0 });

  const variables = useMemo(() => extractVariables(body), [body]);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setLanguage(editing.language || "pt_BR");
      setCategory(
        (editing.category as "UTILITY" | "MARKETING" | "AUTHENTICATION") || "UTILITY"
      );
      setAllowCategoryChange(editing.allowCategoryChange ?? false);
      setBody(editing.body);
      setFooter(editing.footer || "");
      setVariableSamples(editing.variableSamples || []);
      setButtons(editing.buttons || []);

      const header = editing.header;
      if (header?.type) {
        setHeaderType(header.type);
        setHeaderText(header.text || "");
        if (header.type === "IMAGE" && (header.storagePath || header.mediaAssetId)) {
          setHeaderMedia({
            storagePath: header.storagePath || "",
            mediaAssetId: header.mediaAssetId || "",
            previewUrl: header.mediaUrl,
          });
        } else {
          setHeaderMedia(null);
        }
      } else {
        setHeaderType("NONE");
        setHeaderText("");
        setHeaderMedia(null);
      }
      setError("");
      return;
    }

    const empty = emptyFormState();
    setName(empty.name);
    setLanguage(empty.language);
    setCategory(empty.category);
    setAllowCategoryChange(false);
    setHeaderType(empty.headerType);
    setHeaderText(empty.headerText);
    setHeaderMedia(empty.headerMedia);
    setBody(empty.body);
    setFooter(empty.footer);
    setVariableSamples(empty.variableSamples);
    setButtons(empty.buttons);
    setError("");
  }, [editing]);

  useEffect(() => {
    if (!editing?.header?.mediaAssetId || headerMedia?.previewUrl) return;
    apiFetch("/api/media-library")
      .then((res) =>
        parseApiJson<{
          assets?: Array<{
            id: string;
            name: string;
            previewUrl?: string;
            storagePath: string;
          }>;
        }>(res)
      )
      .then((data) => {
        const asset = (data.assets || []).find(
          (a) => a.id === editing.header?.mediaAssetId
        );
        if (asset) {
          setHeaderMedia((prev) =>
            prev
              ? {
                  ...prev,
                  previewUrl: asset.previewUrl || prev.previewUrl,
                  name: asset.name,
                  storagePath: prev.storagePath || asset.storagePath,
                }
              : prev
          );
        }
      })
      .catch(() => undefined);
  }, [editing, headerMedia?.previewUrl]);

  function saveBodySelection() {
    const el = bodyRef.current;
    if (!el) return;
    bodyCursorRef.current = {
      start: el.selectionStart,
      end: el.selectionEnd,
    };
  }

  function addVariable() {
    const next = variables.length > 0 ? Math.max(...variables) + 1 : 1;
    const token = `{{${next}}}`;
    const { start, end } = bodyCursorRef.current;
    const safeStart = Math.min(Math.max(start, 0), body.length);
    const safeEnd = Math.min(Math.max(end, 0), body.length);

    setBody((prev) => prev.slice(0, safeStart) + token + prev.slice(safeEnd));

    const newCursor = safeStart + token.length;
    requestAnimationFrame(() => {
      const el = bodyRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(newCursor, newCursor);
      bodyCursorRef.current = { start: newCursor, end: newCursor };
    });
  }

  function updateSample(index: number, value: string) {
    setVariableSamples((prev) => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  }

  function addButton() {
    if (buttons.length >= 3) return;
    setButtons((prev) => [...prev, { type: "QUICK_REPLY", text: "" }]);
  }

  function parseApiError(data: {
    error?: string;
    details?: { fieldErrors?: Record<string, string[]> };
  }): string {
    const fieldErrors = data.details?.fieldErrors;
    const firstFieldError =
      fieldErrors && Object.values(fieldErrors).flat().find(Boolean);
    return firstFieldError || data.error || "Erro ao salvar template";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const header: TemplateHeader | undefined =
      headerType === "NONE"
        ? undefined
        : {
            type: headerType,
            text: headerType === "TEXT" ? headerText : undefined,
            ...(headerType === "IMAGE" && headerMedia
              ? {
                  storagePath: headerMedia.storagePath,
                  mediaAssetId: headerMedia.mediaAssetId,
                  mediaUrl: headerMedia.previewUrl,
                }
              : {}),
          };

    const samples = variables.map((_, i) => variableSamples[i] || `exemplo_${i + 1}`);

    const payload = {
      language,
      category,
      allowCategoryChange,
      body,
      header,
      variableSamples: samples,
      footer: footer || undefined,
      buttons: buttons.length ? buttons : undefined,
    };

    try {
      const res = isEdit
        ? await apiFetch(`/api/templates/${editing!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await apiFetch("/api/templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, ...payload }),
          });

      const data = await parseApiJson<{
        error?: string;
        details?: { fieldErrors?: Record<string, string[]> };
      }>(res);

      if (!res.ok) {
        throw new Error(parseApiError(data));
      }

      if (!isEdit) {
        const empty = emptyFormState();
        setName(empty.name);
        setBody(empty.body);
        setFooter(empty.footer);
        setHeaderText(empty.headerText);
        setHeaderMedia(empty.headerMedia);
        setHeaderType(empty.headerType);
        setVariableSamples(empty.variableSamples);
        setButtons(empty.buttons);
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card hover={false}>
      <h3 className="mb-4 font-display text-lg font-semibold">
        {isEdit ? "Editar template" : "Novo template"}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            id="tpl-name"
            label="Nome (snake_case)"
            value={name}
            onChange={(e) =>
              setName(
                e.target.value
                  .toLowerCase()
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .replace(/[^a-z0-9_]/g, "_")
                  .replace(/_+/g, "_")
              )
            }
            placeholder="indicacoes_masculino"
            required
            disabled={isEdit}
          />
          <Input
            id="tpl-lang"
            label="Idioma"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          />
          <Select
            id="tpl-category"
            label="Categoria"
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as "UTILITY" | "MARKETING" | "AUTHENTICATION")
            }
          >
            <option value="UTILITY">Utilidade</option>
            <option value="MARKETING">Marketing</option>
            <option value="AUTHENTICATION">Autenticação</option>
          </Select>
        </div>

        <Checkbox
          checked={allowCategoryChange}
          onChange={setAllowCategoryChange}
          label="Permitir que a Meta ajuste a categoria automaticamente. Desmarcado: se a Meta discordar da categoria escolhida, o template é reprovado (não é publicado em outra categoria)."
          labelClassName="items-start text-sm text-app-subtle"
          className="mt-0.5"
        />

        <div className="grid gap-3 md:grid-cols-2">
          <Select
            id="tpl-header-type"
            label="Cabeçalho"
            value={headerType}
            onChange={(e) => setHeaderType(e.target.value as TemplateHeaderType)}
          >
            {HEADER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          {headerType === "TEXT" && (
            <Input
              id="header-text"
              label="Texto do cabeçalho"
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
            />
          )}
          {headerType === "IMAGE" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-app-subtle">
                Imagem do cabeçalho
              </label>
              <TemplateHeaderUploader
                value={headerMedia}
                onChange={setHeaderMedia}
                disabled={loading}
              />
            </div>
          )}
          {["VIDEO", "DOCUMENT"].includes(headerType) && (
            <p className="text-sm text-app-subtle">
              Upload de vídeo/documento ainda não disponível — use imagem ou envie via Meta Business.
            </p>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-app-subtle">Corpo</label>
            <Button
              type="button"
              variant="secondary"
              onMouseDown={(e) => e.preventDefault()}
              onClick={addVariable}
            >
              Adicionar variável
            </Button>
          </div>
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              bodyCursorRef.current = {
                start: e.target.selectionStart,
                end: e.target.selectionEnd,
              };
            }}
            onSelect={saveBodySelection}
            onKeyUp={saveBodySelection}
            onMouseUp={saveBodySelection}
            onClick={saveBodySelection}
            rows={5}
            required
            className="w-full rounded-xl border border-app-border bg-app-secondary/50 p-3 text-sm"
            placeholder="Olá {{1}}, sua consulta está confirmada para {{2}}."
          />
        </div>

        {variables.length > 0 && (
          <div className="grid gap-2 md:grid-cols-2">
            {variables.map((n, i) => (
              <Input
                key={n}
                id={`var-${n}`}
                label={`Exemplo para {{${n}}}`}
                value={variableSamples[i] || ""}
                onChange={(e) => updateSample(i, e.target.value)}
              />
            ))}
          </div>
        )}

        <Input
          id="footer"
          label="Rodapé (máx. 60 caracteres)"
          value={footer}
          onChange={(e) => setFooter(e.target.value.slice(0, 60))}
        />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-app-subtle">Botões (até 3)</label>
            <Button type="button" variant="secondary" onClick={addButton} disabled={buttons.length >= 3}>
              Adicionar botão
            </Button>
          </div>
          <div className="space-y-2">
            {buttons.map((btn, index) => (
              <div key={index} className="grid gap-2 rounded-xl border border-app-border p-3 md:grid-cols-4">
                <Select
                  compact
                  value={btn.type}
                  onChange={(e) => {
                    const type = e.target.value as TemplateButton["type"];
                    setButtons((prev) => {
                      const copy = [...prev];
                      if (type === "QUICK_REPLY") copy[index] = { type, text: "" };
                      else if (type === "URL") copy[index] = { type, text: "", url: "" };
                      else if (type === "PHONE_NUMBER")
                        copy[index] = { type, text: "", phone: "" };
                      else copy[index] = { type: "COPY_CODE", text: "" };
                      return copy;
                    });
                  }}
                >
                  {BUTTON_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
                <input
                  value={btn.text}
                  onChange={(e) => {
                    const text = e.target.value;
                    setButtons((prev) => {
                      const copy = [...prev];
                      copy[index] = { ...copy[index]!, text } as TemplateButton;
                      return copy;
                    });
                  }}
                  placeholder="Texto do botão"
                  className="rounded-lg border border-app-border bg-app-secondary/50 px-2 py-2 text-sm"
                />
                {btn.type === "URL" && (
                  <input
                    value={btn.url}
                    onChange={(e) => {
                      setButtons((prev) => {
                        const copy = [...prev];
                        copy[index] = { type: "URL", text: btn.text, url: e.target.value };
                        return copy;
                      });
                    }}
                    placeholder="https://..."
                    className="rounded-lg border border-app-border bg-app-secondary/50 px-2 py-2 text-sm md:col-span-2"
                  />
                )}
                {btn.type === "PHONE_NUMBER" && (
                  <input
                    value={btn.phone}
                    onChange={(e) => {
                      setButtons((prev) => {
                        const copy = [...prev];
                        copy[index] = {
                          type: "PHONE_NUMBER",
                          text: btn.text,
                          phone: e.target.value,
                        };
                        return copy;
                      });
                    }}
                    placeholder="5522..."
                    className="rounded-lg border border-app-border bg-app-secondary/50 px-2 py-2 text-sm md:col-span-2"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={loading}>
            {isEdit ? "Salvar alterações" : "Salvar template"}
          </Button>
          {isEdit && onCancelEdit && (
            <Button type="button" variant="secondary" onClick={onCancelEdit}>
              Cancelar edição
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
