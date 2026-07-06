"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  defaultDispatchState,
  dispatchStateToQuietHours,
  type DispatchFormState,
} from "@/components/campaigns/CampaignDispatchMode";
import {
  defaultParameterValues,
  mappingStringToParameterValue,
  parameterValuesToMapping,
  type ParameterMappingValue,
} from "@/components/campaigns/CampaignParameterMapper";
import {
  emptySpreadsheetState,
  type SpreadsheetImportState,
} from "@/components/campaigns/CampaignSpreadsheetImport";
import {
  buildHeaderImageMappingOptions,
  type HeaderImageMode,
} from "@/components/campaigns/CampaignHeaderImageSection";
import { CampaignWizardStepper } from "@/components/campaigns/CampaignWizardStepper";
import { CampaignAudienceStep } from "@/components/campaigns/steps/CampaignAudienceStep";
import { CampaignDispatchStep } from "@/components/campaigns/steps/CampaignDispatchStep";
import { CampaignMessageStep } from "@/components/campaigns/steps/CampaignMessageStep";
import { CampaignSetupStep } from "@/components/campaigns/steps/CampaignSetupStep";
import {
  type AudienceMode,
  type CampaignWizardStep,
} from "@/components/campaigns/campaign-wizard-types";
import { validateWizardStep } from "@/components/campaigns/campaign-wizard-validation";
import type { MediaLibrarySelection } from "@/components/media/MediaLibraryPicker";
import { appAlert } from "@/lib/app-dialog";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import {
  buildCampaignParameters,
  buildPreviewContact,
  countTemplateVariables,
  templateHasImageHeader,
} from "@/lib/campaign-params";
import { getSpreadsheetColumnOptions } from "@/lib/campaign-spreadsheet";
import {
  buildOriginSpreadsheetFields,
  originFieldOptionsForOrigin,
  suggestParameterValuesForOrigin,
} from "@/lib/campaign-origin-defaults";
import type {
  Campaign,
  CampaignAudienceType,
  Contact,
  ContactList,
  ContactOrigin,
  Template,
} from "@/lib/types";

interface CampaignCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  lists: ContactList[];
  templates: Template[];
  editing?: Campaign | null;
}

export function CampaignCreateModal({
  open,
  onClose,
  onCreated,
  lists,
  templates,
  editing,
}: CampaignCreateModalProps) {
  const isEdit = Boolean(editing);
  const approvedTemplates = templates.filter((t) => t.status === "approved");

  const [step, setStep] = useState<CampaignWizardStep>(0);
  const [maxReachedStep, setMaxReachedStep] = useState<CampaignWizardStep>(0);
  const [stepError, setStepError] = useState("");

  const [creating, setCreating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [preview, setPreview] = useState<{
    audienceCount: number;
    excludedRecentCount?: number;
    excludedTagsCount?: number;
    excludedClassesCount?: number;
    invalidCount?: number;
    renderedSamples?: string[];
  } | null>(null);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [eligibleCount, setEligibleCount] = useState<number | null>(null);
  const [origins, setOrigins] = useState<ContactOrigin[]>([]);
  const [contactOriginId, setContactOriginId] = useState("");
  const [originEligibleCount, setOriginEligibleCount] = useState<number | null>(null);

  const [audienceMode, setAudienceMode] = useState<AudienceMode>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedLeadClasses, setSelectedLeadClasses] = useState<number[]>([]);
  const [originFieldFilters, setOriginFieldFilters] = useState<Record<string, string>>({});
  const [originContacts, setOriginContacts] = useState<Contact[]>([]);
  const [excludeTags, setExcludeTags] = useState<string[]>([]);
  const [excludeLeadClasses, setExcludeLeadClasses] = useState<number[]>([]);
  const [spreadsheet, setSpreadsheet] = useState<SpreadsheetImportState>(
    emptySpreadsheetState
  );
  const [duplicatePolicy, setDuplicatePolicy] = useState<
    "tag_existing" | "skip" | "update"
  >("tag_existing");
  const [excludeRecentEnabled, setExcludeRecentEnabled] = useState(false);
  const [excludeRecentDays, setExcludeRecentDays] = useState("7");
  const [lastImportStats, setLastImportStats] = useState<{
    created: number;
    updated: number;
    skipped: number;
  } | null>(null);

  const [form, setForm] = useState({
    name: "",
    templateName: "",
    contactListId: "",
    testPhone: "",
  });
  const [dispatch, setDispatch] = useState<DispatchFormState>(defaultDispatchState);
  const [paramValues, setParamValues] = useState<ParameterMappingValue[]>([]);
  const [headerImageMode, setHeaderImageMode] = useState<HeaderImageMode>("fixed");
  const [headerImageSelection, setHeaderImageSelection] =
    useState<MediaLibrarySelection | null>(null);
  const [headerImageMapping, setHeaderImageMapping] = useState("");
  const [libraryAssets, setLibraryAssets] = useState<
    Array<{ id: string; name: string }>
  >([]);

  const handleSpreadsheetChange = useCallback((state: SpreadsheetImportState) => {
    setSpreadsheet(state);
    setPreview(null);
  }, []);

  const handleClose = useCallback(() => {
    setStep(0);
    setMaxReachedStep(0);
    setStepError("");
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setMaxReachedStep(0);
    setStepError("");
    if (editing) {
      setForm({
        name: editing.name,
        templateName: editing.templateName,
        contactListId: editing.contactListId || "",
        testPhone: "",
      });
      setDispatch({
        ...defaultDispatchState,
        dispatchMode: editing.dispatchMode || "immediate",
        cadenceConfig: editing.cadenceConfig || defaultDispatchState.cadenceConfig,
        maxSendsPerRun: editing.maxSendsPerRun || 20,
        dailySendLimit: editing.dailySendLimit
          ? String(editing.dailySendLimit)
          : "",
        quietHoursEnabled: editing.quietHours?.enabled || false,
        quietHoursStart: editing.quietHours?.start || "22:00",
        quietHoursEnd: editing.quietHours?.end || "08:00",
      });
      const mapping = editing.parameterMapping || [];
      setParamValues(
        mapping.length > 0
          ? mapping.map((m) => mappingStringToParameterValue(m))
          : defaultParameterValues(1)
      );
      setContactOriginId(editing.contactOriginId || "");
      if (editing.audienceType === "origin" || editing.contactOriginId) {
        setAudienceMode("origin");
      } else {
        setAudienceMode("keep");
      }
      setHeaderImageMode(editing.headerImageMode || "fixed");
      setHeaderImageMapping(editing.headerImageMapping || "");
      if (editing.headerImageAssetId || editing.headerImageStoragePath) {
        setHeaderImageSelection({
          assetId: editing.headerImageAssetId || "",
          storagePath: editing.headerImageStoragePath || "",
        });
      } else {
        setHeaderImageSelection(null);
      }
      if (editing.excludeRecentDays && editing.excludeRecentDays > 0) {
        setExcludeRecentEnabled(true);
        setExcludeRecentDays(String(editing.excludeRecentDays));
      } else {
        setExcludeRecentEnabled(false);
        setExcludeRecentDays("7");
      }
      setExcludeTags(editing.excludeTags || []);
      setExcludeLeadClasses(editing.excludeLeadClasses || []);
      if (editing.audienceType === "classes") {
        setAudienceMode("classes");
        setSelectedLeadClasses(editing.audienceConfig?.leadClasses || []);
      }
      if (editing.audienceConfig?.originFieldFilters) {
        setOriginFieldFilters(editing.audienceConfig.originFieldFilters);
      }
    } else {
      setForm({
        name: "",
        templateName: approvedTemplates[0]?.name || "",
        contactListId: "",
        testPhone: "",
      });
      setDispatch(defaultDispatchState);
      setParamValues(defaultParameterValues(1));
      setAudienceMode("all");
      setContactOriginId("");
      setHeaderImageMode("fixed");
      setHeaderImageSelection(null);
      setHeaderImageMapping("");
      setExcludeRecentEnabled(false);
      setExcludeRecentDays("7");
    }
    setSelectedTags([]);
    setSelectedLeadClasses([]);
    setOriginFieldFilters({});
    setOriginContacts([]);
    setExcludeTags([]);
    setExcludeLeadClasses([]);
    setSpreadsheet(emptySpreadsheetState);
    setPreview(null);
    setLastImportStats(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  useEffect(() => {
    if (!open) return;
    apiFetch("/api/contact-origins")
      .then((res) => parseApiJson<{ origins?: ContactOrigin[] }>(res))
      .then((data) => setOrigins(data.origins || []))
      .catch(() => setOrigins([]));
  }, [open]);

  useEffect(() => {
    if (!open || audienceMode !== "all") return;
    apiFetch("/api/campaigns/preview", { method: "POST", body: JSON.stringify({}) })
      .then((res) => parseApiJson<{ audienceCount?: number }>(res))
      .then((data) => setEligibleCount(data.audienceCount ?? null))
      .catch(() => setEligibleCount(null));
  }, [open, audienceMode]);

  useEffect(() => {
    if (!open || !contactOriginId || audienceMode !== "origin") {
      setOriginEligibleCount(null);
      return;
    }
    const filters = Object.fromEntries(
      Object.entries(originFieldFilters).filter(([, value]) => value)
    );
    const days = Number(excludeRecentDays);
    const exclusionPayload: Record<string, unknown> = {};
    if (excludeRecentEnabled && days >= 1 && days <= 365) {
      exclusionPayload.excludeRecentDays = Math.floor(days);
    }
    if (excludeTags.length > 0) exclusionPayload.excludeTags = excludeTags;
    if (excludeLeadClasses.length > 0) {
      exclusionPayload.excludeLeadClasses = excludeLeadClasses;
    }

    apiFetch("/api/campaigns/preview", {
      method: "POST",
      body: JSON.stringify({
        audienceType: "origin",
        originId: contactOriginId,
        audienceConfig: { originId: contactOriginId, originFieldFilters: filters },
        ...exclusionPayload,
      }),
    })
      .then((res) => parseApiJson<{ audienceCount?: number }>(res))
      .then((data) => setOriginEligibleCount(data.audienceCount ?? null))
      .catch(() => setOriginEligibleCount(null));
  }, [open, contactOriginId, audienceMode, originFieldFilters, excludeRecentEnabled, excludeRecentDays, excludeTags, excludeLeadClasses]);

  useEffect(() => {
    if (!open || !contactOriginId) {
      setOriginContacts([]);
      return;
    }
    apiFetch(`/api/contacts?originId=${encodeURIComponent(contactOriginId)}`)
      .then((res) => parseApiJson<{ contacts?: Contact[] }>(res))
      .then((data) => setOriginContacts(data.contacts || []))
      .catch(() => setOriginContacts([]));
  }, [open, contactOriginId]);

  useEffect(() => {
    if (!open || contactsLoaded) return;
    apiFetch("/api/contacts")
      .then((res) => parseApiJson<{ contacts?: Contact[] }>(res))
      .then((data) => {
        setContacts(data.contacts || []);
        setContactsLoaded(true);
      })
      .catch(() => setContactsLoaded(true));
  }, [open, contactsLoaded]);

  const selectedTemplate = approvedTemplates.find((t) => t.name === form.templateName);
  const showHeaderImage = templateHasImageHeader(selectedTemplate?.header);

  useEffect(() => {
    if (!open || !templateHasImageHeader(selectedTemplate?.header)) return;
    apiFetch("/api/media-library")
      .then((res) => parseApiJson<{ assets?: Array<{ id: string; name: string }> }>(res))
      .then((data) => setLibraryAssets(data.assets || []))
      .catch(() => setLibraryAssets([]));
  }, [open, selectedTemplate]);

  useEffect(() => {
    if (!open || !editing?.headerImageAssetId || headerImageSelection?.previewUrl) return;
    if (!headerImageSelection?.assetId) return;
    apiFetch("/api/media-library")
      .then((res) =>
        parseApiJson<{
          assets?: Array<{ id: string; previewUrl?: string; name?: string }>;
        }>(res)
      )
      .then((data) => {
        const asset = (data.assets || []).find(
          (a) => a.id === headerImageSelection.assetId
        );
        if (asset?.previewUrl) {
          setHeaderImageSelection((prev) =>
            prev
              ? {
                  ...prev,
                  previewUrl: asset.previewUrl,
                  name: asset.name,
                }
              : prev
          );
        }
      })
      .catch(() => undefined);
  }, [open, editing, headerImageSelection?.assetId, headerImageSelection?.previewUrl]);

  const templateVarCount = selectedTemplate
    ? countTemplateVariables(selectedTemplate.body)
    : 0;

  const selectedOrigin = useMemo(
    () => origins.find((o) => o.id === contactOriginId) ?? null,
    [origins, contactOriginId]
  );

  const originFieldOptions = useMemo(
    () => originFieldOptionsForOrigin(selectedOrigin),
    [selectedOrigin]
  );

  const originSpreadsheetFields = useMemo(
    () => buildOriginSpreadsheetFields(selectedOrigin),
    [selectedOrigin]
  );

  useEffect(() => {
    if (!open || isEdit || !contactOriginId || templateVarCount === 0) return;
    const origin = origins.find((o) => o.id === contactOriginId);
    if (!origin) return;
    setParamValues(suggestParameterValuesForOrigin(origin, templateVarCount));
  }, [contactOriginId, templateVarCount, origins, open, isEdit]);

  useEffect(() => {
    if (!selectedTemplate) return;
    setParamValues((prev) => {
      if (prev.length === templateVarCount) return prev;
      return defaultParameterValues(templateVarCount);
    });
  }, [selectedTemplate, templateVarCount]);

  const allTags = useMemo(
    () => [...new Set(contacts.flatMap((c) => c.tags || []))].sort(),
    [contacts]
  );

  const columnOptions = useMemo(
    () => getSpreadsheetColumnOptions(spreadsheet.mapping),
    [spreadsheet.mapping]
  );

  const headerMappingOptions = useMemo(
    () =>
      buildHeaderImageMappingOptions({
        originFieldOptions,
        columnOptions,
        assets: libraryAssets,
      }),
    [originFieldOptions, columnOptions, libraryAssets]
  );

  const estimatedAudienceCount = useMemo(() => {
    if (preview?.audienceCount !== undefined) return preview.audienceCount;
    if (audienceMode === "upload") return spreadsheet.validation?.valid || 0;
    if (audienceMode === "classes") return selectedLeadClasses.length > 0 ? null : 0;
    if (audienceMode === "origin") return originEligibleCount;
    if (audienceMode === "tags") return null;
    if (audienceMode === "all") return eligibleCount;
    return 0;
  }, [
    preview,
    audienceMode,
    spreadsheet.validation,
    eligibleCount,
    originEligibleCount,
    selectedLeadClasses.length,
  ]);

  const validationInput = useMemo(
    () => ({
      step,
      form,
      audienceMode,
      selectedTags,
      selectedLeadClasses,
      spreadsheet,
      contactOriginId,
      templateVarCount,
      paramValues,
      showHeaderImage,
      headerImageMode,
      headerImageSelection,
      headerImageMapping,
    }),
    [
      step,
      form,
      audienceMode,
      selectedTags,
      selectedLeadClasses,
      spreadsheet,
      contactOriginId,
      templateVarCount,
      paramValues,
      showHeaderImage,
      headerImageMode,
      headerImageSelection,
      headerImageMapping,
    ]
  );

  const audienceModes = useMemo(() => {
    const modes: Array<{ value: AudienceMode; label: string; group: "crm" | "import" }> =
      [];
    if (isEdit) {
      modes.push({
        value: "keep",
        label: "Manter público atual",
        group: "crm",
      });
    }
    modes.push(
      { value: "all", label: "Todos que autorizaram campanhas", group: "crm" },
      ...(contactOriginId
        ? [{ value: "origin" as AudienceMode, label: "Por origem selecionada", group: "crm" as const }]
        : []),
      { value: "tags", label: "Por tags", group: "crm" },
      { value: "classes", label: "Por classe de lead", group: "crm" }
    );
    if (!isEdit) {
      modes.push({ value: "upload", label: "Planilha", group: "import" });
    }
    return modes;
  }, [isEdit, contactOriginId]);

  if (!open) return null;

  function buildParameterMapping(): string[] {
    return parameterValuesToMapping(paramValues);
  }

  function buildHeaderImagePayload(): Pick<
    Campaign,
    | "headerImageAssetId"
    | "headerImageStoragePath"
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

  function buildAudiencePayload():
    | {
        tags?: string[];
        audienceType?: CampaignAudienceType;
        audienceConfig?: Campaign["audienceConfig"];
      }
    | null {
    const activeOriginFilters = Object.fromEntries(
      Object.entries(originFieldFilters).filter(([, value]) => value)
    );

    switch (audienceMode) {
      case "keep":
        return null;
      case "tags":
        return {
          tags: selectedTags,
          audienceType: "tags",
          audienceConfig: { tags: selectedTags },
        };
      case "classes":
        return {
          audienceType: "classes",
          audienceConfig: { leadClasses: selectedLeadClasses },
        };
      case "upload":
        return { audienceType: "spreadsheet" };
      case "origin":
        return {
          audienceType: "origin",
          audienceConfig: {
            originId: contactOriginId || undefined,
            ...(Object.keys(activeOriginFilters).length
              ? { originFieldFilters: activeOriginFilters }
              : {}),
          },
        };
      case "all":
      default:
        return { audienceType: "all" };
    }
  }

  function buildExclusionPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    const days = Number(excludeRecentDays);
    if (excludeRecentEnabled && days >= 1 && days <= 365) {
      payload.excludeRecentDays = Math.floor(days);
    } else if (isEdit) {
      payload.excludeRecentDays = null;
    }
    if (excludeTags.length > 0) {
      payload.excludeTags = excludeTags;
    } else if (isEdit) {
      payload.excludeTags = null;
    }
    if (excludeLeadClasses.length > 0) {
      payload.excludeLeadClasses = excludeLeadClasses;
    } else if (isEdit) {
      payload.excludeLeadClasses = null;
    }
    return payload;
  }

  function buildCampaignTag(): string {
    return `campanha:${(form.name || "campanha")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32)}-${Date.now().toString(36)}`;
  }

  async function importSpreadsheet(tag: string) {
    const validRows = spreadsheet.mappedRows.filter((r) => r.phone);
    const res = await apiFetch("/api/campaigns/import-contacts", {
      method: "POST",
      body: JSON.stringify({
        tag,
        duplicatePolicy,
        originId: contactOriginId || undefined,
        contacts: validRows.map((r) => ({
          name: r.name || r.phone,
          phone: r.phone,
          tags: r.tags,
          customFields: r.customFields,
          originId: contactOriginId || undefined,
          originFields: r.originFields,
        })),
      }),
    });
    const data = await parseApiJson<{
      error?: string;
      created?: number;
      updated?: number;
      skipped?: number;
    }>(res);
    if (!res.ok) throw new Error(data.error || "Erro ao importar planilha.");
    const stats = {
      created: data.created ?? 0,
      updated: data.updated ?? 0,
      skipped: data.skipped ?? 0,
    };
    setLastImportStats(stats);
    return { tag, stats };
  }

  async function handlePreview() {
    setPreviewing(true);
    try {
      const audience = buildAudiencePayload();
      const payload: Record<string, unknown> = {
        ...(audience || {}),
        parameterMapping: buildParameterMapping(),
        templateName: form.templateName,
        ...(contactOriginId ? { originId: contactOriginId } : {}),
        ...buildHeaderImagePayload(),
        ...buildExclusionPayload(),
      };

      if (audienceMode === "upload" && spreadsheet.mappedRows.length > 0) {
        payload.uploadPreview = {
          rows: spreadsheet.mappedRows.map((r) => ({
            name: r.name,
            phone: r.phone,
            tags: r.tags,
            customFields: r.customFields,
            originId: contactOriginId || undefined,
            originFields: r.originFields,
          })),
        };
      }

      const res = await apiFetch("/api/campaigns/preview", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await parseApiJson<{
        error?: string;
        audienceCount?: number;
        excludedRecentCount?: number;
        excludedTagsCount?: number;
        excludedClassesCount?: number;
        invalidCount?: number;
        renderedSamples?: string[];
      }>(res);
      if (!res.ok) throw new Error(data.error || "Erro no preview.");
      setPreview({
        audienceCount: data.audienceCount || 0,
        excludedRecentCount: data.excludedRecentCount,
        excludedTagsCount: data.excludedTagsCount,
        excludedClassesCount: data.excludedClassesCount,
        invalidCount: data.invalidCount,
        renderedSamples: data.renderedSamples,
      });
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Erro", {
        title: "Erro",
        variant: "error",
      });
    } finally {
      setPreviewing(false);
    }
  }

  async function handleTestSend() {
    if (!form.testPhone.trim()) {
      await appAlert("Informe um telefone para o envio teste.", {
        title: "Telefone obrigatório",
        variant: "warning",
      });
      return;
    }
    setTesting(true);
    try {
      const mapping = buildParameterMapping();
      let parameters: string[];

      if (spreadsheet.mappedRows[0] && audienceMode === "upload") {
        const sample = spreadsheet.mappedRows[0];
        const contact = buildPreviewContact({
          name: sample.name || sample.phone,
          phone: sample.phone,
          customFields: sample.customFields,
          originFields: sample.originFields,
          originId: contactOriginId || undefined,
        });
        parameters = buildCampaignParameters(contact, mapping);
      } else {
        parameters = mapping.map((key) => {
          if (key === "first_name" || key === "name") return "Teste";
          if (key === "phone") return form.testPhone;
          if (key === "literal_today") return new Date().toLocaleDateString("pt-BR");
          if (key.startsWith("literal:")) return key.slice("literal:".length);
          if (key.startsWith("origin:")) return `[${key.slice("origin:".length)}]`;
          return "";
        });
      }

      const res = await apiFetch("/api/campaigns/test", {
        method: "POST",
        body: JSON.stringify({
          templateName: form.templateName,
          phone: form.testPhone,
          parameters,
          ...buildHeaderImagePayload(),
        }),
      });
      const data = await parseApiJson<{ error?: string; messageId?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Erro no envio teste.");
      await appAlert(`Teste enviado. ID: ${data.messageId || "—"}`, {
        title: "Teste enviado",
        variant: "success",
      });
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Erro", {
        title: "Erro",
        variant: "error",
      });
    } finally {
      setTesting(false);
    }
  }

  function validateCurrentStep(): boolean {
    const error = validateWizardStep(validationInput);
    setStepError(error || "");
    return !error;
  }

  function handleContinue() {
    if (!validateCurrentStep()) return;
    const next = Math.min(3, step + 1) as CampaignWizardStep;
    setStep(next);
    setMaxReachedStep((prev) => (next > prev ? next : prev));
    setStepError("");
  }

  function handleBack() {
    setStepError("");
    setStep((prev) => Math.max(0, prev - 1) as CampaignWizardStep);
  }

  function handleStepClick(target: CampaignWizardStep) {
    if (target > step) {
      for (let s = step; s < target; s++) {
        const error = validateWizardStep({ ...validationInput, step: s as CampaignWizardStep });
        if (error) {
          setStep(s as CampaignWizardStep);
          setStepError(error);
          return;
        }
      }
    }
    setStepError("");
    setStep(target);
  }

  async function submitCampaign() {
    for (let s = 0; s <= 2; s++) {
      const error = validateWizardStep({
        ...validationInput,
        step: s as CampaignWizardStep,
      });
      if (error) {
        setStep(s as CampaignWizardStep);
        setStepError(error);
        return;
      }
    }
    setStepError("");
    setCreating(true);
    try {
      let audience = buildAudiencePayload();
      let importStats: Campaign["importStats"] | undefined;

      if (!isEdit && audienceMode === "upload") {
        if (!spreadsheet.ready) {
          throw new Error("Envie e mapeie uma planilha válida.");
        }
        const tag = buildCampaignTag();
        const { tag: importedTag, stats } = await importSpreadsheet(tag);
        audience = {
          tags: [importedTag],
          audienceType: "spreadsheet",
          audienceConfig: {
            spreadsheetTag: importedTag,
            columnMapping: spreadsheet.mapping,
            tags: [importedTag],
          },
        };
        importStats = {
          total: spreadsheet.validation?.total || spreadsheet.mappedRows.length,
          imported: stats.created,
          skipped: stats.skipped,
          invalid: spreadsheet.validation?.invalid || 0,
          updated: stats.updated,
        };
      }

      const basePayload = {
        name: form.name,
        templateName: form.templateName,
        maxSendsPerRun: dispatch.maxSendsPerRun,
        parameterMapping: buildParameterMapping(),
        dispatchMode: dispatch.dispatchMode,
        cadenceConfig:
          dispatch.dispatchMode === "cadence" ? dispatch.cadenceConfig : undefined,
        scheduledAt: dispatch.scheduledAt
          ? new Date(dispatch.scheduledAt).toISOString()
          : undefined,
        scheduledEndAt: dispatch.scheduledEndAt
          ? new Date(dispatch.scheduledEndAt).toISOString()
          : undefined,
        dailySendLimit: dispatch.dailySendLimit
          ? Number(dispatch.dailySendLimit)
          : undefined,
        quietHours: dispatchStateToQuietHours(dispatch),
        duplicatePolicy: audienceMode === "upload" ? duplicatePolicy : undefined,
        importStats,
        ...(contactOriginId
          ? {
              contactOriginId,
              contactOriginKey: selectedOrigin?.key,
            }
          : {}),
        ...(audience || {}),
        ...buildHeaderImagePayload(),
        ...buildExclusionPayload(),
      };

      if (isEdit && editing) {
        const res = await apiFetch(`/api/campaigns/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(basePayload),
        });
        const data = await parseApiJson<{ error?: string }>(res);
        if (!res.ok) throw new Error(data.error || "Erro ao salvar campanha.");
      } else {
        const res = await apiFetch("/api/campaigns", {
          method: "POST",
          body: JSON.stringify(basePayload),
        });
        const data = await parseApiJson<{ error?: string }>(res);
        if (!res.ok) throw new Error(data.error || "Erro ao criar campanha.");
      }

      onCreated();
      handleClose();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Erro", {
        title: "Erro",
        variant: "error",
      });
    } finally {
      setCreating(false);
    }
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    setPreview(null);
  }

  function toggleLeadClass(value: number) {
    setSelectedLeadClasses((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
    setPreview(null);
  }

  function toggleExcludeTag(tag: string) {
    setExcludeTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    setPreview(null);
  }

  function toggleExcludeLeadClass(value: number) {
    setExcludeLeadClasses((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
    setPreview(null);
  }

  function handleOriginFieldFilterChange(key: string, value: string) {
    setOriginFieldFilters((prev) => ({ ...prev, [key]: value }));
    setPreview(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-label="Fechar"
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-app-border bg-app-card shadow-2xl">
        <div className="shrink-0 border-b border-app-border px-6 pb-4 pt-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">
              {isEdit ? "Editar campanha" : "Nova campanha"}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg p-2 text-app-muted hover:bg-white/5 hover:text-app-text"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <CampaignWizardStepper
            currentStep={step}
            maxReachedStep={maxReachedStep}
            onStepClick={handleStepClick}
          />
        </div>

        {/* Submissão nativa desativada: o botão Continuar vira "Criar" no último
            passo e o React reaproveita o mesmo <button>, fazendo o clique da
            transição disparar o submit antes do usuário ver o passo Envio. */}
        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {step === 0 && (
              <CampaignSetupStep
                form={form}
                onFormChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
                approvedTemplates={approvedTemplates}
                contactOriginId={contactOriginId}
                onContactOriginChange={(next) => {
                  setContactOriginId(next);
                  setPreview(null);
                  if (next && !isEdit) {
                    setAudienceMode("origin");
                  }
                }}
                origins={origins}
                selectedOrigin={selectedOrigin}
                isEdit={isEdit}
              />
            )}

            {step === 1 && (
              <CampaignAudienceStep
                isEdit={isEdit}
                editing={editing}
                audienceMode={audienceMode}
                onAudienceModeChange={(mode) => {
                  setAudienceMode(mode);
                  setPreview(null);
                }}
                audienceModes={audienceModes}
                eligibleCount={eligibleCount}
                originEligibleCount={originEligibleCount}
                selectedOrigin={selectedOrigin}
                originFieldFilters={originFieldFilters}
                onOriginFieldFilterChange={handleOriginFieldFilterChange}
                originContacts={originContacts}
                allTags={allTags}
                selectedTags={selectedTags}
                onToggleTag={toggleTag}
                selectedLeadClasses={selectedLeadClasses}
                onToggleLeadClass={toggleLeadClass}
                excludeTags={excludeTags}
                onToggleExcludeTag={toggleExcludeTag}
                excludeLeadClasses={excludeLeadClasses}
                onToggleExcludeLeadClass={toggleExcludeLeadClass}
                spreadsheet={spreadsheet}
                onSpreadsheetChange={handleSpreadsheetChange}
                templateVarCount={templateVarCount}
                originSpreadsheetFields={originSpreadsheetFields}
                duplicatePolicy={duplicatePolicy}
                onDuplicatePolicyChange={setDuplicatePolicy}
                excludeRecentEnabled={excludeRecentEnabled}
                onExcludeRecentEnabledChange={(enabled) => {
                  setExcludeRecentEnabled(enabled);
                  setPreview(null);
                }}
                excludeRecentDays={excludeRecentDays}
                onExcludeRecentDaysChange={(days) => {
                  setExcludeRecentDays(days);
                  setPreview(null);
                }}
              />
            )}

            {step === 2 && (
              <CampaignMessageStep
                selectedTemplate={selectedTemplate}
                templateVarCount={templateVarCount}
                paramValues={paramValues}
                onParamValuesChange={setParamValues}
                columnOptions={columnOptions}
                originFieldOptions={originFieldOptions}
                sampleRow={spreadsheet.mappedRows[0] || null}
                showHeaderImage={showHeaderImage}
                headerImageMode={headerImageMode}
                onHeaderImageModeChange={setHeaderImageMode}
                headerImageSelection={headerImageSelection}
                onHeaderImageSelectionChange={setHeaderImageSelection}
                headerImageMapping={headerImageMapping}
                onHeaderImageMappingChange={setHeaderImageMapping}
                headerMappingOptions={headerMappingOptions}
                testPhone={form.testPhone}
                onTestPhoneChange={(phone) =>
                  setForm((prev) => ({ ...prev, testPhone: phone }))
                }
                onTestSend={handleTestSend}
                testing={testing}
                creating={creating}
              />
            )}

            {step === 3 && (
              <CampaignDispatchStep
                dispatch={dispatch}
                onDispatchChange={setDispatch}
                estimatedAudienceCount={estimatedAudienceCount || 0}
                preview={preview}
                spreadsheet={spreadsheet}
                lastImportStats={lastImportStats}
                previewing={previewing}
                onPreview={handlePreview}
              />
            )}

            {stepError && (
              <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {stepError}
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-app-border px-6 py-4">
            <div>
              {step > 0 && (
                <Button type="button" variant="secondary" onClick={handleBack}>
                  Voltar
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {step < 3 ? (
                <Button key="continue" type="button" onClick={handleContinue}>
                  Continuar
                </Button>
              ) : (
                <Button
                  key="create"
                  type="button"
                  loading={creating}
                  onClick={() => void submitCampaign()}
                >
                  {isEdit ? "Salvar alterações" : "Criar campanha"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
