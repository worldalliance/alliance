import {
  tasksGetFormResponsesByFormsAdmin,
  type ActionFormVariantsListDto,
  type FormDto,
  type FormResponseDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useFormWithdrawalsAdmin } from "@alliance/shared/lib/useFormWithdrawalsAdmin";
import { taskFormQuery } from "@alliance/shared/lib/useTaskForm";
import {
  skipToken,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useMemo } from "react";
import type {
  FormWithSchema,
  ResponseVariantOption,
} from "../components/FormResponsesView";
import { adminRefusalMessage } from "./adminRefusal";
import { sortResponsesByCreatedAtAsc } from "./sortResponses";
import { useFormShareLinksAdmin } from "./useFormShareLinksAdmin";
import { useFormVariantsAdmin } from "./useFormVariantsAdmin";

type SchemaField = {
  id?: string;
  kind?: string;
  label?: string;
  type?: string;
};
type SchemaShape = { pages?: Array<{ fields?: SchemaField[] }> };

/**
 * Union the fields across every variant form so the merged view's CSV export,
 * stats, questions and filters cover variant-only questions — not just the
 * default form's. The default form supplies the base schema (title, ordering,
 * outputViews …); fields that appear only in other variants are appended in a
 * synthetic page, deduped by field id. (Downstream consumers flatten fields
 * across pages, so the extra page is invisible; the per-response renderer uses
 * each response's own snapshot, so this only feeds the aggregate views.)
 */
const mergeVariantFields = (
  defaultForm: FormWithSchema,
  allForms: FormWithSchema[],
): FormWithSchema => {
  const baseSchema = defaultForm.schema as unknown as SchemaShape;
  const seen = new Set<string>();
  for (const page of baseSchema.pages ?? []) {
    for (const field of page.fields ?? []) {
      if (typeof field.id === "string") seen.add(field.id);
    }
  }

  const extraFields: SchemaField[] = [];
  for (const form of allForms) {
    if (form.id === defaultForm.id) continue;
    const schema = form.schema as unknown as SchemaShape;
    for (const page of schema.pages ?? []) {
      for (const field of page.fields ?? []) {
        if (typeof field.id === "string" && !seen.has(field.id)) {
          seen.add(field.id);
          extraFields.push(field);
        }
      }
    }
  }

  if (extraFields.length === 0) return defaultForm;

  return {
    ...defaultForm,
    schema: {
      ...(defaultForm.schema as unknown as object),
      pages: [
        ...(baseSchema.pages ?? []),
        { id: "__variant_extra_fields__", fields: extraFields },
      ],
    },
  } as unknown as FormWithSchema;
};

const LOAD_ERROR = "Failed to load form responses";

/** One option per form that actually exists (default + each variant). */
const variantOptionsOf = ({
  stats,
}: ActionFormVariantsListDto): ResponseVariantOption[] =>
  stats
    .filter((s): s is typeof s & { formId: number } => s.formId != null)
    .map((s) => ({
      key: s.variantId == null ? "default" : String(s.variantId),
      variantId: s.variantId,
      formId: s.formId,
      name: s.variantId == null ? "Default" : s.name,
    }));

const defaultOptionOf = (
  options: ResponseVariantOption[],
): ResponseVariantOption | undefined =>
  options.find((o) => o.variantId == null) ?? options[0];

const NO_RESPONSES: FormResponseDto[] = [];

const combineForms = (results: UseQueryResult<FormDto>[]) => ({
  // Unparsed: the server validates a form's schema before storing it.
  forms: results.flatMap((result) =>
    result.data ? [result.data as unknown as FormWithSchema] : [],
  ),
  isPending: results.some((result) => result.isPending),
  failure: results.find((result) => result.isLoadingError)?.error ?? null,
});

/** Responses across every form variant of an action (default form + each A/B
 * variant). A failed `refresh` keeps what already loaded on screen. */
export function useActionMergedResponsesAdmin(actionId: number) {
  const queryClient = useQueryClient();
  const { variants } = useFormVariantsAdmin(actionId, variantOptionsOf);
  const variantOptions = variants.data;
  const formIds = useMemo(
    () => variantOptions?.map((option) => option.formId),
    [variantOptions],
  );
  const defaultFormId = defaultOptionOf(variantOptions ?? [])?.formId;

  const forms = useQueries({
    queries: (formIds ?? []).map((formId) => taskFormQuery(formId)),
    combine: combineForms,
  });

  const responses = useQuery({
    queryKey: queryKeys.formResponsesByFormsAdmin(formIds ?? null),
    queryFn:
      formIds === undefined
        ? skipToken
        : () =>
            formIds.length === 0
              ? Promise.resolve(NO_RESPONSES)
              : tasksGetFormResponsesByFormsAdmin({
                  body: { formIds },
                  throwOnError: true,
                }).then((res) => res.data),
    select: sortResponsesByCreatedAtAsc,
  });

  // Share links and withdrawals resolve to the owning action, so one form id
  // covers every variant.
  const shareLinks = useFormShareLinksAdmin(defaultFormId);
  const withdrawals = useFormWithdrawalsAdmin(defaultFormId);

  const refresh = useMutation({
    mutationFn: () =>
      Promise.all([
        ...[
          queryKeys.formVariantsAdmin(actionId),
          ...(formIds ?? []).map((formId) => queryKeys.taskForm(formId)),
          queryKeys.formResponsesByFormsAdmin(formIds ?? null),
          queryKeys.formWithdrawalsAdmin(defaultFormId ?? null),
        ].map((queryKey) =>
          queryClient.refetchQueries(
            { queryKey, exact: true },
            { throwOnError: true },
          ),
        ),
        shareLinks.refetch(),
      ]),
  });

  const form = useMemo(() => {
    const defaultForm =
      forms.forms.find((f) => f.id === defaultFormId) ?? forms.forms[0];
    return defaultForm ? mergeVariantFields(defaultForm, forms.forms) : null;
  }, [forms.forms, defaultFormId]);

  const variantsFailure = variants.isLoadingError ? variants.error : null;
  const failure =
    variantsFailure ??
    forms.failure ??
    (responses.isLoadingError ? responses.error : null);

  return {
    variantOptions,
    form,
    responses: responses.data ?? NO_RESPONSES,
    sidsToUserMap: shareLinks.sidsToUserMap,
    referralsError: shareLinks.referralsError,
    withdrawnUserMap: withdrawals.withdrawnUserMap,
    loading:
      !variantsFailure &&
      (variants.isPending ||
        forms.isPending ||
        responses.isPending ||
        withdrawals.isLoading ||
        refresh.isPending),
    error: failure
      ? adminRefusalMessage(failure, LOAD_ERROR)
      : withdrawals.isLoadingError
        ? "Failed to load withdrawals"
        : null,
    refresh,
  };
}
