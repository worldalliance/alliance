import type {
  AnyField,
  FieldKind,
  FormSchema,
  Page,
} from "@alliance/common/forms/form-schema";
import type {
  ActionWithdrawalDto,
  FormDto,
  FormResponseDto,
  ProfileDto,
} from "@alliance/shared/client";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import FormRenderer from "@alliance/sharedweb/forms/FormRenderer";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@alliance/sharedweb/ui/HoverCard";
import { CirclePlay } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import {
  getDirectSnapshotTarget,
  type ReturnToState,
  type SnapshotMigrationTarget,
} from "../lib/navigation";
import FormResponseStatistics from "./FormResponseStatistics";
import SnapshotTargetPicker from "./SnapshotTargetPicker";

const WithdrawalBadge: React.FC<{ className?: string }> = ({ className }) => (
  <span
    className={cn(
      "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800",
      className,
    )}
  >
    Withdrew
  </span>
);

const WithdrawalInfo: React.FC<{ withdrawal: ActionWithdrawalDto }> = ({
  withdrawal,
}) => {
  const hasDetails =
    withdrawal.outOfTime || withdrawal.isMoral || withdrawal.declineReason;

  if (!hasDetails) {
    return <WithdrawalBadge className="whitespace-nowrap" />;
  }

  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <WithdrawalBadge className="whitespace-nowrap cursor-default" />
        }
      />
      <HoverCardContent>
        <div className="flex flex-col items-center gap-0.5">
          {withdrawal.outOfTime && (
            <span className="text-orange-600">Out of time</span>
          )}
          {withdrawal.isMoral && (
            <span className="text-amber-600">Moral objection</span>
          )}
          {withdrawal.declineReason && (
            <span className="text-zinc-500">{withdrawal.declineReason}</span>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export type FormWithSchema = Pick<
  FormDto,
  "id" | "title" | "formSnapshotId"
> & {
  schema: FormSchema;
  pages?: Page[];
};

export const sortResponsesByCreatedAtAsc = (
  list: FormResponseDto[],
): FormResponseDto[] => {
  return [...list].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
};

/**
 * A single group of responses within a merged view. `formId` is the cloned
 * form backing this variant; `variantId === null` is the action's default form.
 */
export type ResponseVariantOption = {
  key: string;
  variantId: number | null;
  formId: number;
  name: string;
};

// Runtime guard: distinguish answer fields from display blocks
const ANSWER_FIELD_KINDS = new Set<FieldKind>([
  "text",
  "textarea",
  "email",
  "number",
  "range",
  "phone",
  "checkbox",
  "radio",
  "select",
  "multiselect",
  "ranking",
  "date",
  "time",
  "timezone",
  "city",
  "file",
]);

const FILTERABLE_FIELD_KINDS = new Set<FieldKind>([
  "checkbox",
  "radio",
  "select",
  "multiselect",
  "range",
]);

const AI_SCORE_FIELD_KINDS = new Set<FieldKind>(["text", "textarea"]);

type Tab = "responses" | "stats" | "questions";

type ResponseFilterOp = "equals" | "includes" | "no-response";

export type FormResponseFilter = {
  fieldId: string;
  op: ResponseFilterOp;
  value?: string;
};

const isAnswerField = (
  node: unknown,
): node is { id: string; label: string } => {
  if (!node || typeof node !== "object") return false;
  const anyNode = node as { kind: string; id: string; label: string };
  return (
    typeof anyNode.kind === "string" &&
    ANSWER_FIELD_KINDS.has(anyNode.kind as FieldKind) &&
    typeof anyNode.id === "string" &&
    typeof anyNode.label === "string"
  );
};

const isResponseFilterOp = (value: string | null): value is ResponseFilterOp =>
  value === "equals" || value === "includes" || value === "no-response";

const isTab = (value: string | null): value is Tab =>
  value === "responses" || value === "stats" || value === "questions";

const normalizeBoolean = (value: unknown): boolean | null => {
  if (value === true || value === false) return value;
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === 1) return true;
  if (value === 0) return false;
  return null;
};

const isNoResponseValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim() === "";
  return false;
};

const getSelections = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (value === null || value === undefined || value === "") return [];
  return [String(value)];
};

const getOptionLabel = (
  field: AnyField,
  value: string | undefined,
): string | undefined => {
  if (!value) return undefined;
  const options =
    (field as { options?: Array<{ value: string; label: string }> }).options ??
    [];
  return options.find((option) => String(option.value) === value)?.label;
};

const formatAiScore = (value: number | null): string => {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return `${Math.round(value * 100)}%`;
};

const matchesResponseFilter = (
  response: FormResponseDto,
  filter: FormResponseFilter,
  field: AnyField,
): boolean => {
  const rawValue = response.answers?.[filter.fieldId];
  if (filter.op === "no-response") {
    return isNoResponseValue(rawValue);
  }

  switch (field.kind) {
    case "checkbox": {
      if (filter.op !== "equals") return false;
      const desired = normalizeBoolean(filter.value);
      const actual = normalizeBoolean(rawValue);
      if (desired === null || actual === null) return false;
      return actual === desired;
    }
    case "multiselect": {
      if (filter.op !== "includes") return false;
      const selections = getSelections(rawValue);
      return selections.includes(filter.value ?? "");
    }
    case "radio":
    case "select":
    case "range": {
      if (filter.op !== "equals") return false;
      if (rawValue === null || rawValue === undefined || rawValue === "") {
        return false;
      }
      return String(rawValue) === (filter.value ?? "");
    }
    default:
      return false;
  }
};

export type FormResponsesViewProps = {
  /** Heading shown in the page header. */
  title: string;
  /** Base form supplying the question schema for labels, filters and stats. */
  form: FormWithSchema | null;
  /** Responses to display (already sorted by the caller). */
  responses: FormResponseDto[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  withdrawnUserMap: Map<number, ActionWithdrawalDto>;
  sidsToUserMap: Record<string, ProfileDto>;
  /** Base filename (without extension) for the CSV export. */
  exportFileBase: string;
  /**
   * When non-empty, shows a "Reassign snapshots" button. It navigates straight
   * to the migration page when the target is unambiguous — one target, or the
   * variant filter already narrowed to one — and otherwise prompts for which
   * form (i.e. which variant) to migrate.
   */
  snapshotTargets?: SnapshotMigrationTarget[];
  /**
   * When provided, enables the variant filter dropdown and per-response variant
   * labels. Each response is matched to a variant by its `formId`.
   */
  variantOptions?: ResponseVariantOption[];
  /**
   * Prefix applied to every URL search param this view reads/writes (tab,
   * filters, variant, …). Set this when embedding the view inside another page
   * that already owns bare param names like `tab` (e.g. the action dashboard).
   */
  paramNamespace?: string;
};

const FormResponsesView: React.FC<FormResponsesViewProps> = ({
  title,
  form,
  responses,
  loading,
  error,
  onRefresh,
  withdrawnUserMap,
  sidsToUserMap,
  exportFileBase,
  snapshotTargets,
  variantOptions,
  paramNamespace,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [page, setPage] = useState(1);
  const [pickingSnapshotTarget, setPickingSnapshotTarget] = useState(false);

  const goToSnapshots = useCallback(
    (formId: number) => {
      navigate(`/forms/${formId}/snapshots`, {
        state: {
          returnTo: `${location.pathname}${location.search}`,
        } satisfies ReturnToState,
      });
    },
    [navigate, location.pathname, location.search],
  );

  const [params, setParams] = useSearchParams();

  // Namespace the param names so an embedding page (which may own a bare `tab`
  // param of its own) doesn't collide with this view's internal state.
  const paramKey = useCallback(
    (name: string) => (paramNamespace ? `${paramNamespace}_${name}` : name),
    [paramNamespace],
  );

  const tabParam = params.get(paramKey("tab"));
  const tab = isTab(tabParam) ? tabParam : "responses";
  const filterFieldId = params.get(paramKey("filterField"))?.trim() ?? "";
  const filterOpParam = params.get(paramKey("filterOp"));
  const filterValueParam = params.get(paramKey("filterValue"));
  const questionFieldParam =
    params.get(paramKey("questionField"))?.trim() ?? "";
  const variantParam = params.get(paramKey("variant"))?.trim() ?? "";

  const updateParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(params);
      Object.entries(updates).forEach(([key, value]) => {
        const namespacedKey = paramKey(key);
        if (value === null || value === undefined) {
          next.delete(namespacedKey);
        } else {
          next.set(namespacedKey, value);
        }
      });
      setParams(next);
    },
    [params, setParams, paramKey],
  );

  const formIdToVariant = useMemo(() => {
    const map = new Map<number, ResponseVariantOption>();
    variantOptions?.forEach((option) => map.set(option.formId, option));
    return map;
  }, [variantOptions]);

  const selectedVariant = useMemo(() => {
    if (!variantOptions || !variantParam) return null;
    return variantOptions.find((option) => option.key === variantParam) ?? null;
  }, [variantOptions, variantParam]);

  const directSnapshotTarget = useMemo(() => {
    return getDirectSnapshotTarget({
      targets: snapshotTargets,
      selectedFormId: selectedVariant?.formId,
    });
  }, [snapshotTargets, selectedVariant]);

  const snapshotPickerTargets =
    pickingSnapshotTarget && !directSnapshotTarget && snapshotTargets?.length
      ? snapshotTargets
      : null;

  // The picker's visibility is derived, so the request to open it has to be
  // withdrawn once it's moot — otherwise a refresh that resolves the ambiguity
  // only hides the modal, and a later one that reintroduces it reopens the
  // modal with no user action.
  useEffect(() => {
    if (directSnapshotTarget || !snapshotTargets?.length) {
      setPickingSnapshotTarget(false);
    }
  }, [directSnapshotTarget, snapshotTargets]);

  // Responses narrowed to the selected variant (or all, when none selected).
  const scopedResponses = useMemo(() => {
    if (!selectedVariant) return responses;
    return responses.filter(
      (response) => response.formId === selectedVariant.formId,
    );
  }, [responses, selectedVariant]);

  const getResponseVariantName = useCallback(
    (response: FormResponseDto): string | null => {
      if (!variantOptions) return null;
      return formIdToVariant.get(response.formId)?.name ?? null;
    },
    [variantOptions, formIdToVariant],
  );

  const activeFilter = useMemo<FormResponseFilter | null>(() => {
    if (!filterFieldId || !isResponseFilterOp(filterOpParam)) return null;
    if (
      (filterOpParam === "equals" || filterOpParam === "includes") &&
      (filterValueParam === null || filterValueParam === "")
    ) {
      return null;
    }
    return {
      fieldId: filterFieldId,
      op: filterOpParam,
      value: filterValueParam ?? undefined,
    };
  }, [filterFieldId, filterOpParam, filterValueParam]);

  const fieldLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    const schema = form?.schema as unknown as {
      pages?: Array<{
        fields?: Array<{ id?: string; label?: string; kind?: string }>;
      }>;
    };
    schema?.pages?.forEach((p) => {
      p.fields?.forEach((f) => {
        if (isAnswerField(f)) {
          labels[f.id] = f.label;
        }
      });
    });
    return labels;
  }, [form]);

  const orderedFieldIds = useMemo(() => {
    const ids: string[] = [];
    const seen = new Set<string>();
    const schema = form?.schema as unknown as {
      pages?: Array<{
        fields?: Array<{ id?: string; label?: string; kind?: string }>;
      }>;
    };
    schema?.pages?.forEach((p) => {
      p.fields?.forEach((f) => {
        if (isAnswerField(f) && !seen.has(f.id)) {
          seen.add(f.id);
          ids.push(f.id);
        }
      });
    });
    return ids;
  }, [form]);

  const fieldsById = useMemo(() => {
    const fields: Record<string, AnyField> = {};
    form?.schema?.pages?.forEach((page) => {
      page.fields.forEach((field) => {
        const candidate = field as AnyField;
        if (
          candidate &&
          typeof candidate === "object" &&
          typeof candidate.id === "string" &&
          typeof candidate.kind === "string"
        ) {
          fields[candidate.id] = candidate;
        }
      });
    });
    return fields;
  }, [form]);

  const activeFilterField = useMemo(() => {
    if (!activeFilter) return null;
    const field = fieldsById[activeFilter.fieldId];
    if (!field || !FILTERABLE_FIELD_KINDS.has(field.kind)) return null;
    return field;
  }, [activeFilter, fieldsById]);

  const filteredResponses = useMemo(() => {
    if (!activeFilter || !activeFilterField) return scopedResponses;
    return scopedResponses.filter((response) =>
      matchesResponseFilter(response, activeFilter, activeFilterField),
    );
  }, [scopedResponses, activeFilter, activeFilterField]);

  const selectedQuestionFieldId = useMemo(() => {
    if (questionFieldParam && orderedFieldIds.includes(questionFieldParam)) {
      return questionFieldParam;
    }
    return orderedFieldIds[0] ?? "";
  }, [questionFieldParam, orderedFieldIds]);

  const selectedQuestionField = useMemo(
    () => fieldsById[selectedQuestionFieldId],
    [fieldsById, selectedQuestionFieldId],
  );

  useEffect(() => {
    setPage(1);
  }, [filterFieldId, filterOpParam, filterValueParam, variantParam]);

  useEffect(() => {
    // Keep current page in range when filtered responses change
    const totalPages = Math.max(1, filteredResponses.length);
    if (page > totalPages) setPage(totalPages);
  }, [filteredResponses.length, page]);

  const total = scopedResponses.length;
  const filteredTotal = filteredResponses.length;
  const totalPages = Math.max(1, filteredTotal);
  const currentResponse = filteredResponses[page - 1];

  const currentResponseAiInlineLabels = useMemo<
    Record<string, React.ReactNode>
  >(() => {
    const response = currentResponse as FormResponseDto | undefined;
    const detections = response?.aiDetectionResults ?? [];
    const inlineScores: Record<string, React.ReactNode> = {};

    for (const detection of detections) {
      if (!detection.fieldPath.startsWith("answers.")) {
        continue;
      }
      const fieldId = detection.fieldPath.slice("answers.".length);
      const field = fieldsById[fieldId];
      if (!field || !AI_SCORE_FIELD_KINDS.has(field.kind)) {
        continue;
      }
      if (
        typeof detection.aiProbability !== "number" ||
        Number.isNaN(detection.aiProbability) ||
        detection.aiProbability <= 0
      ) {
        continue;
      }
      inlineScores[fieldId] = (
        <span className="text-sm font-semibold text-red-600">
          {formatAiScore(detection.aiProbability)}
        </span>
      );
    }

    return inlineScores;
  }, [currentResponse, fieldsById]);

  const filterSummary = useMemo(() => {
    if (!activeFilter || !activeFilterField) return null;
    const fieldLabel = activeFilterField.label?.trim() || "Untitled question";
    if (activeFilter.op === "no-response") {
      return { fieldLabel, description: "No response" };
    }
    const valueLabel = activeFilter.value ?? "";
    switch (activeFilterField.kind) {
      case "checkbox": {
        const normalized = normalizeBoolean(activeFilter.value);
        if (normalized === true) {
          return { fieldLabel, description: "Checked" };
        }
        if (normalized === false) {
          return { fieldLabel, description: "Not checked" };
        }
        return null;
      }
      case "multiselect": {
        const optionLabel = getOptionLabel(
          activeFilterField,
          activeFilter.value,
        );
        return {
          fieldLabel,
          description: `Includes ${optionLabel ?? valueLabel}`,
        };
      }
      case "radio":
      case "select": {
        const optionLabel = getOptionLabel(
          activeFilterField,
          activeFilter.value,
        );
        return { fieldLabel, description: optionLabel ?? valueLabel };
      }
      case "range":
        return { fieldLabel, description: `Value ${valueLabel}` };
      default:
        return null;
    }
  }, [activeFilter, activeFilterField]);

  const emptyStateMessage = filterSummary
    ? "No responses match this filter."
    : "No responses yet for this form.";

  const handleStatFilter = useCallback(
    (filter: FormResponseFilter) => {
      updateParams({
        tab: "responses",
        filterField: filter.fieldId,
        filterOp: filter.op,
        filterValue: filter.value ?? null,
      });
      setPage(1);
    },
    [updateParams],
  );

  const clearFilter = useCallback(() => {
    updateParams({
      filterField: null,
      filterOp: null,
      filterValue: null,
    });
  }, [updateParams]);

  const formatValue = useCallback((v: unknown): string => {
    if (v == null || v === undefined) return "NULL";
    if (Array.isArray(v)) return v.map((x) => formatValue(x)).join(", ");
    if (typeof v === "object") {
      const o = v as { name?: string; key: string };
      if (o && typeof o === "object" && (o.name || o.key)) {
        return o.name || o.key;
      }
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    }
    return String(v);
  }, []);

  const questionResponses = useMemo(() => {
    if (!selectedQuestionFieldId) return [];
    return scopedResponses.filter(
      (response) =>
        !isNoResponseValue(response.answers?.[selectedQuestionFieldId]),
    );
  }, [scopedResponses, selectedQuestionFieldId]);

  const formatSelectedQuestionAnswer = useCallback(
    (value: unknown): string => {
      if (!selectedQuestionField) return formatValue(value);

      switch (selectedQuestionField.kind) {
        case "radio":
        case "select": {
          const normalized =
            value === null || value === undefined ? "" : String(value);
          if (!normalized) return "No response";
          return (
            getOptionLabel(selectedQuestionField, normalized) ?? normalized
          );
        }
        case "multiselect": {
          const selections = getSelections(value);
          if (selections.length === 0) return "No response";
          return selections
            .map(
              (selection) =>
                getOptionLabel(selectedQuestionField, selection) ?? selection,
            )
            .join(", ");
        }
        case "ranking": {
          const ranked = getSelections(value);
          if (ranked.length === 0) return "No response";
          return ranked
            .map(
              (option, index) =>
                `${index + 1}. ${
                  getOptionLabel(selectedQuestionField, option) ?? option
                }`,
            )
            .join(", ");
        }
        default:
          return formatValue(value);
      }
    },
    [selectedQuestionField, formatValue],
  );

  const csvEscape = (s: string): string => {
    const needsQuotes = /[",\n\r]/.test(s);
    let v = s.replace(/"/g, '""');
    v = v.replace(/\r?\n/g, " ");
    return needsQuotes ? `"${v}"` : v;
  };

  const handleExportCsv = useCallback(() => {
    if (!form) return;
    const metaHeaders = ["Response ID", "User ID", "User Name", "SID"];
    if (variantOptions) metaHeaders.push("Variant");
    const used = new Set<string>();
    const questionHeaders = orderedFieldIds.map((id) => {
      const base = fieldLabels[id] || id;
      let name = base;
      let i = 2;
      while (used.has(name)) {
        name = `${base} (${i++})`;
      }
      used.add(name);
      return name;
    });
    const headers = [...metaHeaders, ...questionHeaders];

    const rows = scopedResponses.map((resp) => {
      const user = resp?.user;
      const userName = [user?.name ?? resp.id].filter(Boolean).join(" ");
      const values = [
        String(resp.id ?? ""),
        String(user?.id ?? ""),
        userName,
        resp.sid ?? "",
        ...(variantOptions ? [getResponseVariantName(resp) ?? ""] : []),
        ...orderedFieldIds.map((id) => formatValue(resp.answers?.[id])),
      ];
      return values;
    });

    const csv = [
      headers.map(csvEscape).join(","),
      ...rows.map((r) => r.map((c) => csvEscape(String(c ?? ""))).join(",")),
    ].join("\n");

    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeTitle = exportFileBase.replace(/[^a-z0-9-_]+/gi, "-");
    a.href = url;
    a.download = `${safeTitle}-responses.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [
    form,
    scopedResponses,
    orderedFieldIds,
    fieldLabels,
    formatValue,
    exportFileBase,
    variantOptions,
    getResponseVariantName,
  ]);

  const [userSearch, setUserSearch] = useState("");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        userSearchRef.current &&
        !userSearchRef.current.contains(e.target as Node)
      ) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const respondentName = currentResponse
    ? (currentResponse.user?.name ??
      (sidsToUserMap[currentResponse.sid ?? ""]
        ? "anonymous invited by " +
          sidsToUserMap[currentResponse.sid ?? ""]?.displayName
        : "anonymous"))
    : "";

  const currentWithdrawal =
    currentResponse?.user?.id != null
      ? (withdrawnUserMap.get(currentResponse.user.id) ?? null)
      : null;

  const getRespondentName = useCallback(
    (response: FormResponseDto): string => {
      return (
        response.user?.name ??
        (sidsToUserMap[response.sid ?? ""]
          ? "anonymous invited by " +
            sidsToUserMap[response.sid ?? ""]?.displayName
          : "anonymous")
      );
    },
    [sidsToUserMap],
  );

  const userSearchResults = useMemo(() => {
    const query = userSearch.toLowerCase();
    const items = filteredResponses.map((response, idx) => ({
      response,
      idx,
      name: getRespondentName(response),
    }));
    if (!query) return items;
    const matched = items.filter(({ name }) =>
      name.toLowerCase().includes(query),
    );
    matched.sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(query) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(query) ? 0 : 1;
      return aStarts - bStarts;
    });
    return matched;
  }, [filteredResponses, userSearch, getRespondentName]);

  const handleUserSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && userSearchResults.length > 0) {
        e.preventDefault();
        setPage(userSearchResults[0].idx + 1);
        setUserSearch("");
        setUserDropdownOpen(false);
      }
    },
    [userSearchResults],
  );

  const currentResponseVariantName = currentResponse
    ? getResponseVariantName(currentResponse)
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
                <p className="text-sm text-gray-500">
                  {total} response{total === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-3">
                <Button
                  onClick={() => updateParams({ tab: "responses" })}
                  color={
                    tab === "responses" ? ButtonColor.Black : ButtonColor.White
                  }
                  size="small"
                >
                  Responses
                </Button>
                <Button
                  onClick={() => updateParams({ tab: "stats" })}
                  color={
                    tab === "stats" ? ButtonColor.Black : ButtonColor.White
                  }
                  size="small"
                >
                  Stats
                </Button>
                <Button
                  onClick={() =>
                    updateParams({
                      tab: "questions",
                      questionField: selectedQuestionFieldId || null,
                    })
                  }
                  color={
                    tab === "questions" ? ButtonColor.Black : ButtonColor.White
                  }
                  size="small"
                >
                  Questions
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {variantOptions && variantOptions.length > 0 && (
                <select
                  value={variantParam || "all"}
                  onChange={(e) =>
                    updateParams({
                      variant: e.target.value === "all" ? null : e.target.value,
                    })
                  }
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-black focus:outline-none"
                  title="Filter by variant"
                >
                  <option value="all">All variants</option>
                  {variantOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.name}
                    </option>
                  ))}
                </select>
              )}
              <Button
                onClick={onRefresh}
                color={ButtonColor.White}
                size="small"
              >
                Refresh
              </Button>
              {snapshotTargets && snapshotTargets.length > 0 && (
                <Button
                  onClick={() => {
                    if (directSnapshotTarget) {
                      goToSnapshots(directSnapshotTarget.formId);
                    } else {
                      setPickingSnapshotTarget(true);
                    }
                  }}
                  color={ButtonColor.White}
                  size="small"
                >
                  Reassign snapshots
                </Button>
              )}
              <Button
                onClick={handleExportCsv}
                disabled={scopedResponses.length === 0}
                color={ButtonColor.Black}
                size="small"
              >
                Export CSV
              </Button>
            </div>
          </div>
        </div>
        {/* Response Navigator (inside header) */}
        {tab === "responses" && !loading && !error && filteredTotal > 0 && (
          <div className="px-6 pb-4 border-t border-gray-100 pt-3">
            {filterSummary && (
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="text-sm text-gray-600">
                  Filtered:{" "}
                  <span className="font-medium text-gray-900">
                    {filterSummary.fieldLabel}
                  </span>{" "}
                  — {filterSummary.description}{" "}
                  <span className="text-gray-400">
                    ({filteredTotal} of {total})
                  </span>
                </div>
                <Button
                  onClick={clearFilter}
                  color={ButtonColor.White}
                  size="small"
                >
                  Clear filter
                </Button>
              </div>
            )}
            <div className="flex items-center justify-between flex-wrap md:flex-nowrap gap-3">
              {/* Pagination Controls */}
              <div className="flex items-center gap-1">
                <Button
                  disabled={page <= 1}
                  onClick={() => setPage(1)}
                  color={ButtonColor.Black}
                  size="small"
                >
                  First
                </Button>
                <Button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  color={ButtonColor.Black}
                  size="small"
                >
                  &larr; Prev
                </Button>
                <div className="px-4 py-1.5 text-sm font-medium text-gray-700 min-w-[100px] text-center">
                  {page} of {totalPages}
                </div>
                <Button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  color={ButtonColor.Black}
                  size="small"
                >
                  Next &rarr;
                </Button>
                <Button
                  disabled={page >= totalPages}
                  onClick={() => setPage(totalPages)}
                  color={ButtonColor.Black}
                  size="small"
                >
                  Last
                </Button>
              </div>

              {/* User Search Dropdown */}
              <div className="relative" ref={userSearchRef}>
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setUserDropdownOpen(true);
                  }}
                  onFocus={() => setUserDropdownOpen(true)}
                  onKeyDown={handleUserSearchKeyDown}
                  placeholder="Search by name..."
                  className="w-56 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-black focus:outline-none"
                />
                {userDropdownOpen && (
                  <div className="absolute z-30 mt-1 w-72 max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                    {userSearchResults.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500">
                        No matching responses
                      </div>
                    ) : (
                      userSearchResults.map(({ response, idx, name }) => (
                        <button
                          key={response.id ?? `${response.sid}-${idx}`}
                          type="button"
                          className={cn(
                            "w-full text-left px-3 py-2 text-sm hover:bg-gray-100 border-b border-gray-50 last:border-b-0",
                            idx + 1 === page && "bg-blue-50 font-medium",
                          )}
                          onClick={() => {
                            setPage(idx + 1);
                            setUserSearch("");
                            setUserDropdownOpen(false);
                          }}
                        >
                          <div className="truncate text-gray-900">{name}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(response.createdAt).toLocaleString()}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Response Info */}
              {currentResponse && (
                <div className="flex items-center gap-4">
                  <div className="text-right min-w-[200px]">
                    <div className="flex items-center justify-end gap-2">
                      <p className="font-medium text-gray-900 truncate max-w-[700px]">
                        {respondentName}
                      </p>
                      {currentResponseVariantName && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 whitespace-nowrap">
                          {currentResponseVariantName}
                        </span>
                      )}
                      {currentWithdrawal && (
                        <WithdrawalInfo withdrawal={currentWithdrawal} />
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {new Date(currentResponse.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {currentResponse.sessionReplayUrl && (
                    <Button
                      size="small"
                      color={ButtonColor.BlueOutline}
                      onClick={() =>
                        window.open(
                          "https://us.posthog.com/project/188181/replay/home?sessionRecordingId=" +
                            currentResponse.sessionReplayUrl!.substring(
                              currentResponse.sessionReplayUrl!.lastIndexOf(
                                "/",
                              ) + 1,
                            ),
                          "_blank",
                        )
                      }
                    >
                      <CirclePlay size={14} className="mr-1.5" />
                      Replay
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {tab === "responses" && (
        <div className="px-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500">Loading responses...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-red-500">{error}</p>
            </div>
          ) : filteredTotal === 0 ? (
            <Card style={CardStyle.White} className="flex items-center gap-3">
              <p className="text-gray-600">{emptyStateMessage}</p>
              {filterSummary && (
                <Button
                  onClick={clearFilter}
                  color={ButtonColor.White}
                  size="small"
                >
                  Clear filter
                </Button>
              )}
            </Card>
          ) : (
            <>
              {/* Form Response */}
              {form !== null && (
                <div className="max-w-[600px] mx-auto">
                  {(() => {
                    const responseSchema =
                      (currentResponse?.schemaSnapshot as unknown as FormSchema) ??
                      form.schema;
                    return (
                      <div className="bg-white p-6 border border-gray-200 rounded-lg">
                        <FormRenderer
                          id={currentResponse?.formId ?? form.id}
                          formSnapshotId={
                            currentResponse?.formSnapshotId ??
                            form.formSnapshotId
                          }
                          actionId={0}
                          form={responseSchema}
                          completedFormResponse={currentResponse}
                          renderFormAsCompleted
                          onSubmit={null}
                          userId={currentResponse?.user?.id}
                          user={currentResponse?.user ?? undefined}
                          adminPreviewUserId={currentResponse?.user?.id}
                          disableOptionRandomization
                          fieldLabelRightContent={currentResponseAiInlineLabels}
                        />
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          )}
        </div>
      )}
      {tab === "stats" && (
        <FormResponseStatistics
          form={form}
          responses={scopedResponses}
          onFilterSelect={handleStatFilter}
        />
      )}
      {tab === "questions" && (
        <div className="px-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500">Loading responses...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-red-500">{error}</p>
            </div>
          ) : orderedFieldIds.length === 0 ? (
            <Card style={CardStyle.White}>
              <p className="text-gray-600">No answerable questions found.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 mt-3">
                <label
                  htmlFor="question-field-select"
                  className="text-xs font-semibold tracking-wide text-gray-600 uppercase"
                >
                  Question
                </label>
                <select
                  id="question-field-select"
                  value={selectedQuestionFieldId}
                  onChange={(event) =>
                    updateParams({ questionField: event.target.value })
                  }
                  className="w-full max-w-xl rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none"
                >
                  {orderedFieldIds.map((fieldId) => (
                    <option key={fieldId} value={fieldId}>
                      {fieldLabels[fieldId] || fieldId}
                    </option>
                  ))}
                </select>
              </div>

              {questionResponses.length === 0 ? (
                <Card style={CardStyle.White}>
                  <p className="text-gray-600">
                    No users responded to this question.
                  </p>
                </Card>
              ) : (
                <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                  <div className="grid grid-cols-1 gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold tracking-wide text-gray-600 uppercase md:grid-cols-[260px_minmax(0,1fr)_auto]">
                    <div>Respondent</div>
                    <div>Answer</div>
                    {selectedQuestionField &&
                      AI_SCORE_FIELD_KINDS.has(selectedQuestionField.kind) && (
                        <div>AI Score</div>
                      )}
                  </div>
                  {questionResponses.map((response, index) => {
                    const answerValue = selectedQuestionFieldId
                      ? response.answers?.[selectedQuestionFieldId]
                      : null;
                    const variantName = getResponseVariantName(response);
                    const aiDetection =
                      selectedQuestionField &&
                      AI_SCORE_FIELD_KINDS.has(selectedQuestionField.kind)
                        ? (response.aiDetectionResults ?? []).find(
                            (d) =>
                              d.fieldPath ===
                              `answers.${selectedQuestionFieldId}`,
                          )
                        : null;
                    return (
                      <div
                        key={
                          response.id ??
                          `${response.sid ?? "anonymous"}-${
                            response.createdAt
                          }-${index}`
                        }
                        className={cn(
                          "grid grid-cols-1 gap-1 border-b border-gray-100 px-3 py-2 last:border-b-0 md:gap-3",
                          selectedQuestionField &&
                            AI_SCORE_FIELD_KINDS.has(selectedQuestionField.kind)
                            ? "md:grid-cols-[260px_minmax(0,1fr)_auto]"
                            : "md:grid-cols-[260px_minmax(0,1fr)]",
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {getRespondentName(response)}
                            </p>
                            {variantName && (
                              <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {variantName}
                              </span>
                            )}
                            {response.user?.id != null &&
                              withdrawnUserMap.has(response.user.id) && (
                                <WithdrawalBadge className="shrink-0" />
                              )}
                          </div>
                          <p className="text-xs text-gray-500">
                            {new Date(response.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-5">
                            {formatSelectedQuestionAnswer(answerValue)}
                          </p>
                        </div>
                        {selectedQuestionField &&
                          AI_SCORE_FIELD_KINDS.has(
                            selectedQuestionField.kind,
                          ) && (
                            <div className="flex items-start">
                              <span
                                className={cn(
                                  "text-sm font-semibold",
                                  aiDetection &&
                                    typeof aiDetection.aiProbability ===
                                      "number" &&
                                    aiDetection.aiProbability > 0
                                    ? "text-red-600"
                                    : "text-gray-400",
                                )}
                              >
                                {formatAiScore(
                                  aiDetection?.aiProbability ?? null,
                                )}
                              </span>
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {snapshotPickerTargets && (
        <SnapshotTargetPicker
          targets={snapshotPickerTargets}
          onSelect={(target) => {
            setPickingSnapshotTarget(false);
            goToSnapshots(target.formId);
          }}
          onCancel={() => setPickingSnapshotTarget(false)}
        />
      )}
    </div>
  );
};

export default FormResponsesView;
