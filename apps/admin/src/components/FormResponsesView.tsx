import {
  type AnyField,
  type FormSchema,
  type Page,
} from "@alliance/common/forms/form-schema";
import { collectOutputFieldMap } from "@alliance/common/forms/output-resolution";
import type {
  ActionWithdrawalDto,
  FormDto,
  FormResponseDto,
  ProfileDto,
} from "@alliance/shared/client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { downloadBlob } from "../lib/downloadBlob";
import {
  getDirectSnapshotTarget,
  type ReturnToState,
  type SnapshotMigrationTarget,
} from "../lib/navigation";
import { respondentName as buildRespondentName } from "../lib/respondent";
import { answerFieldLabels } from "../lib/responseFields";
import {
  FILTERABLE_FIELD_KINDS,
  filterDescription,
  isResponseFilterOp,
  matchesResponseFilter,
  type FormResponseFilter,
} from "../lib/responseFilter";
import { buildResponsesCsv } from "../lib/responsesCsvExport";
import { buildResponsesHtml } from "../lib/responsesHtmlExport";
import FormResponsesHeader, {
  isTab,
} from "./form-responses/FormResponsesHeader";
import QuestionResponses from "./form-responses/QuestionResponses";
import ResponseReplay from "./form-responses/ResponseReplay";
import ResponseReplayNavigator from "./form-responses/ResponseReplayNavigator";
import { useRespondentSearch } from "./form-responses/useRespondentSearch";
import FormResponseStatistics from "./FormResponseStatistics";
import ResponsesTable from "./responses-table/ResponsesTable";
import SnapshotTargetPicker from "./SnapshotTargetPicker";

export type FormWithSchema = Pick<
  FormDto,
  "id" | "title" | "formSnapshotId"
> & {
  schema: FormSchema;
  pages?: Page[];
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

export const REFERRALS_LOAD_ERROR =
  "Failed to load share links, so invited respondents show as anonymous";

export const REFRESH_ERROR = "Failed to refresh form responses";

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
  referralsError?: string | null;
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
  referralsError,
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

  const { fieldLabels, orderedFieldIds } = useMemo(() => {
    const labels = answerFieldLabels(form?.schema);
    return { fieldLabels: labels, orderedFieldIds: [...labels.keys()] };
  }, [form]);

  const fieldsById = useMemo(
    () =>
      form?.schema
        ? collectOutputFieldMap(form.schema)
        : new Map<string, AnyField>(),
    [form],
  );

  const activeFilterField = useMemo(() => {
    if (!activeFilter) return null;
    const field = fieldsById.get(activeFilter.fieldId);
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
  const currentResponse = filteredResponses[page - 1];

  const filterSummary = useMemo(() => {
    if (!activeFilter || !activeFilterField) return null;
    return filterDescription({
      filter: activeFilter,
      field: activeFilterField,
      responses: scopedResponses,
    });
  }, [activeFilter, activeFilterField, scopedResponses]);

  const handleStatFilter = useCallback(
    (filter: FormResponseFilter) => {
      updateParams({
        tab: "replays",
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

  const handleExportCsv = useCallback(() => {
    if (!form) return;
    const csv = buildResponsesCsv({
      responses: scopedResponses,
      orderedFieldIds,
      fieldLabels,
      variantName: variantOptions && getResponseVariantName,
    });
    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const safeTitle = exportFileBase.replace(/[^a-z0-9-_]+/gi, "-");
    downloadBlob(blob, `${safeTitle}-responses.csv`);
  }, [
    form,
    scopedResponses,
    orderedFieldIds,
    fieldLabels,
    exportFileBase,
    variantOptions,
    getResponseVariantName,
  ]);

  const handleExportHtml = useCallback(() => {
    if (!form) return;
    const safeTitle = exportFileBase.replace(/[^a-z0-9-_]+/gi, "-");
    const html = buildResponsesHtml({
      title,
      form,
      responses,
      withdrawnUserMap,
      sidsToUserMap,
      variantOptions,
      exportedAt: new Date().toISOString(),
      csvFileName: `${safeTitle}-responses.csv`,
    });

    const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
    downloadBlob(blob, `${safeTitle}-responses.html`);
  }, [
    form,
    title,
    responses,
    withdrawnUserMap,
    sidsToUserMap,
    variantOptions,
    exportFileBase,
  ]);

  const getRespondentName = useCallback(
    (response: FormResponseDto): string =>
      buildRespondentName({ response, sidsToUserMap }),
    [sidsToUserMap],
  );

  const respondentSearch = useRespondentSearch({
    responses: filteredResponses,
    getRespondentName,
    onSelect: useCallback((index: number) => setPage(index + 1), []),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <FormResponsesHeader
          title={title}
          responses={responses}
          total={total}
          referralsError={referralsError}
          tab={tab}
          onTabChange={(next) =>
            updateParams(
              next === "questions"
                ? { tab: next, questionField: selectedQuestionFieldId || null }
                : { tab: next },
            )
          }
          variantOptions={variantOptions}
          selectedVariantKey={variantParam}
          onVariantChange={(key) => updateParams({ variant: key })}
          onRefresh={onRefresh}
          onReassignSnapshots={
            snapshotTargets && snapshotTargets.length > 0
              ? () => {
                  if (directSnapshotTarget) {
                    goToSnapshots(directSnapshotTarget.formId);
                  } else {
                    setPickingSnapshotTarget(true);
                  }
                }
              : undefined
          }
          onExportCsv={handleExportCsv}
          onExportHtml={handleExportHtml}
        />
        {tab === "replays" && !loading && !error && filteredTotal > 0 && (
          <ResponseReplayNavigator
            filterSummary={filterSummary}
            filteredTotal={filteredTotal}
            total={total}
            onClearFilter={clearFilter}
            page={page}
            onPageChange={setPage}
            search={respondentSearch}
            currentResponse={currentResponse}
            getRespondentName={getRespondentName}
            getResponseVariantName={getResponseVariantName}
            withdrawnUserMap={withdrawnUserMap}
          />
        )}
      </div>

      {tab === "replays" && (
        <ResponseReplay
          loading={loading}
          error={error}
          form={form}
          filteredTotal={filteredTotal}
          filterActive={filterSummary !== null}
          onClearFilter={clearFilter}
          currentResponse={currentResponse}
          fieldsById={fieldsById}
        />
      )}
      {tab === "responses" && (
        <div className="px-2 py-3">
          <ResponsesTable
            form={form}
            responses={scopedResponses}
            variantOptions={variantOptions}
            withdrawnUserMap={withdrawnUserMap}
            sidsToUserMap={sidsToUserMap}
            loading={loading}
            error={error}
            paramKey={paramKey}
          />
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
        <QuestionResponses
          loading={loading}
          error={error}
          responses={scopedResponses}
          orderedFieldIds={orderedFieldIds}
          fieldLabels={fieldLabels}
          fieldsById={fieldsById}
          selectedQuestionFieldId={selectedQuestionFieldId}
          onSelectQuestionField={(fieldId) =>
            updateParams({ questionField: fieldId })
          }
          getResponseVariantName={getResponseVariantName}
          getRespondentName={getRespondentName}
          withdrawnUserMap={withdrawnUserMap}
        />
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
