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
import type { UseMutationResult } from "@tanstack/react-query";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router";
import { type SnapshotMigrationTarget } from "../lib/navigation";
import { respondentName as buildRespondentName } from "../lib/respondent";
import { answerFieldLabels } from "../lib/responseFields";
import {
  FILTERABLE_FIELD_KINDS,
  filterDescription,
  isResponseFilterOp,
  matchesResponseFilter,
  type FormResponseFilter,
} from "../lib/responseFilter";
import { Banner, BannerTone } from "../ui/templates/Banner";
import { PageBody } from "../ui/templates/Page";
import { RefreshFailedBanner } from "../ui/templates/States";
import QuestionResponses from "./form-responses/QuestionResponses";
import ResponseReplay from "./form-responses/ResponseReplay";
import ResponseReplayNavigator from "./form-responses/ResponseReplayNavigator";
import {
  exportFilterDescriptions,
  exportResponsesCsv,
  exportResponsesHtml,
} from "./form-responses/responsesExports";
import ResponsesViewBar, {
  isTab,
  ResponsesTab,
} from "./form-responses/ResponsesViewBar";
import { useRespondentSearch } from "./form-responses/useRespondentSearch";
import FormResponseStatistics from "./FormResponseStatistics";
import ResponsesTable from "./responses-table/ResponsesTable";
import { useResponsesTable } from "./responses-table/useResponsesTable";
import { useSnapshotReassign } from "./SnapshotTargetPicker";

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

/** The host's refetch of everything the view shows. */
export type ResponsesRefresh = Pick<
  UseMutationResult<unknown, Error, void>,
  "mutate" | "isPending" | "isError" | "error"
>;

export type FormResponsesViewProps = {
  /** The responses' title in the HTML export; the host shows its own heading. */
  title: string;
  /** Base form supplying the question schema for labels, filters and stats. */
  form: FormWithSchema | null;
  /** Responses to display (already sorted by the caller). */
  responses: FormResponseDto[];
  loading: boolean;
  error: string | null;
  refresh: ResponsesRefresh;
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
  refresh,
  withdrawnUserMap,
  sidsToUserMap,
  referralsError,
  exportFileBase,
  snapshotTargets,
  variantOptions,
  paramNamespace,
}) => {
  const onRefresh = () => refresh.mutate();
  const [page, setPage] = useState(1);
  const [params, setParams] = useSearchParams();

  // Namespace the param names so an embedding page (which may own a bare `tab`
  // param of its own) doesn't collide with this view's internal state.
  const paramKey = useCallback(
    (name: string) => (paramNamespace ? `${paramNamespace}_${name}` : name),
    [paramNamespace],
  );

  const tabParam = params.get(paramKey("tab"));
  const tab = isTab(tabParam) ? tabParam : ResponsesTab.Responses;
  const filterFieldId = params.get(paramKey("filterField"))?.trim() ?? "";
  const filterOpParam = params.get(paramKey("filterOp"));
  const filterValueParam = params.get(paramKey("filterValue"));
  const questionFieldParam =
    params.get(paramKey("questionField"))?.trim() ?? "";
  const variantParam = params.get(paramKey("variant"))?.trim() ?? "";

  const updateParams = useCallback(
    (
      updates: Record<string, string | null | undefined>,
      { replace = false }: { replace?: boolean } = {},
    ) => {
      const next = new URLSearchParams(params);
      Object.entries(updates).forEach(([key, value]) => {
        const namespacedKey = paramKey(key);
        if (value === null || value === undefined) {
          next.delete(namespacedKey);
        } else {
          next.set(namespacedKey, value);
        }
      });
      setParams(next, { replace });
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
    if (!field || !FILTERABLE_FIELD_KINDS[field.kind]) return null;
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
        tab: ResponsesTab.Replays,
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

  // The table's state lives here, beside the exports, so they can read what
  // the table shows (`table.sortedRows`, after its search and version filter).
  const table = useResponsesTable({
    form,
    responses: scopedResponses,
    variantOptions,
    withdrawnUserMap,
    sidsToUserMap,
    paramKey,
  });

  // Both exports hold exactly the table's rows, in its order; the columns stay complete.
  const exportRows = useMemo(
    () => table.sortedRows.map((row) => row.original.response),
    [table.sortedRows],
  );
  const exportFilters = exportFilterDescriptions({
    variantName: selectedVariant?.name ?? null,
    query: table.query,
    snapshotId: table.selectedSnapshotId,
  });

  const { reassign, picker } = useSnapshotReassign({
    targets: snapshotTargets,
    selectedFormId: selectedVariant?.formId,
  });

  const scrolling = (children: ReactNode) => (
    <div className="min-h-0 flex-1 overflow-auto">{children}</div>
  );

  const body: Record<ResponsesTab, () => ReactNode> = {
    [ResponsesTab.Responses]: () => (
      <ResponsesTable
        table={table}
        form={form}
        withdrawnUserMap={withdrawnUserMap}
        sidsToUserMap={sidsToUserMap}
        loading={loading}
        error={error}
        onRetry={onRefresh}
        onReassign={reassign ?? null}
      />
    ),
    [ResponsesTab.Stats]: () =>
      scrolling(
        <PageBody className="max-w-5xl">
          <FormResponseStatistics
            form={form}
            responses={scopedResponses}
            loading={loading}
            error={error}
            onRetry={onRefresh}
            onFilterSelect={handleStatFilter}
          />
        </PageBody>,
      ),
    [ResponsesTab.Questions]: () =>
      scrolling(
        <QuestionResponses
          loading={loading}
          error={error}
          onRetry={onRefresh}
          responses={scopedResponses}
          orderedFieldIds={orderedFieldIds}
          fieldLabels={fieldLabels}
          fieldsById={fieldsById}
          selectedQuestionFieldId={selectedQuestionFieldId}
          onSelectQuestionField={(fieldId) =>
            updateParams({ questionField: fieldId }, { replace: true })
          }
          getResponseVariantName={getResponseVariantName}
          getRespondentName={getRespondentName}
          withdrawnUserMap={withdrawnUserMap}
        />,
      ),
    [ResponsesTab.Replays]: () => (
      <>
        {!loading && !error && filteredTotal > 0 && (
          <div className="shrink-0">
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
          </div>
        )}
        {scrolling(
          <ResponseReplay
            loading={loading}
            error={error}
            form={form}
            filteredTotal={filteredTotal}
            filterActive={filterSummary !== null}
            onClearFilter={clearFilter}
            currentResponse={currentResponse}
            fieldsById={fieldsById}
          />,
        )}
      </>
    ),
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <RefreshFailedBanner
        things="responses"
        query={{
          // A failed retry of a failed first load has nothing earlier to show.
          isRefetchError: refresh.isError && error === null,
          isFetching: refresh.isPending,
          error: refresh.error,
          refetch: onRefresh,
        }}
      />
      {referralsError && (
        <Banner tone={BannerTone.Warning}>{referralsError}</Banner>
      )}
      <ResponsesViewBar
        responses={responses}
        total={total}
        tab={tab}
        onTabChange={(next) =>
          updateParams(
            next === ResponsesTab.Questions
              ? { tab: next, questionField: selectedQuestionFieldId || null }
              : { tab: next === ResponsesTab.Responses ? null : next },
          )
        }
        variantOptions={variantOptions}
        selectedVariantKey={variantParam}
        onVariantChange={(key) =>
          updateParams({ variant: key }, { replace: true })
        }
        onRefresh={onRefresh}
        loading={loading}
        error={error}
        onReassignSnapshots={reassign}
        exportCount={exportRows.length}
        exportFilters={exportFilters}
        onExportCsv={() =>
          form &&
          exportResponsesCsv({
            responses: exportRows,
            orderedFieldIds,
            fieldLabels,
            schema: form.schema,
            formId: form.id,
            variantName: variantOptions && getResponseVariantName,
            exportFileBase,
          })
        }
        onExportHtml={() =>
          form &&
          exportResponsesHtml({
            title,
            form,
            responses: exportRows,
            withdrawnUserMap,
            sidsToUserMap,
            variantOptions,
            filters: exportFilters,
            exportFileBase,
          })
        }
      />
      {body[tab]()}
      {picker}
    </div>
  );
};

export default FormResponsesView;
