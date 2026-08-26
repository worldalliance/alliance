import { FORM_RESPONSES_BY_FORMS_MAX_BATCH } from "@alliance/common/forms/form-responses";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { chunk } from "es-toolkit";
import { useCallback, useMemo } from "react";
import {
  tasksDeleteFormAdmin,
  tasksGetFormResponseCountsAdmin,
  tasksListFormsAdmin,
} from "../client";
import type { FormResponseCountDto, FormSummaryDto } from "../client/types.gen";
import { queryKeys } from "./queryKeys";

const QUERY_KEY = queryKeys.formsAdmin();

// Pickers mount repeatedly while editing a form, and FormsList remounts on
// every trip out to a form's responses and back. Cache the index and the
// counts drawn beside it for 30 seconds; writes invalidate both immediately.
const FORMS_STALE_TIME = 30 * 1000;

const NO_FORMS: readonly FormSummaryDto[] = [];

/** Invalidates the form index and every cached per-form field list. */
export function useInvalidateFormsAdmin(): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.formsAdminAll() }),
    [queryClient],
  );
}

/**
 * Invalidates only the form index. Action writes can change `usedInAction`,
 * but cannot change a form's fields.
 */
export function useInvalidateFormsIndex(): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.formsAdmin() }),
    [queryClient],
  );
}

// Newest first: the endpoint orders by id descending, which the forms e2e
// spec pins, and every consumer renders the list as it arrives.
function useFormsQuery() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      tasksListFormsAdmin({ throwOnError: true }).then(
        (response) => response.data,
      ),
    staleTime: FORMS_STALE_TIME,
  });
}

export function useFormsAdmin() {
  const invalidateForms = useInvalidateFormsAdmin();
  const { data, isLoading, isError } = useFormsQuery();

  const { mutateAsync: deleteForm } = useMutation({
    mutationFn: (id: number) =>
      tasksDeleteFormAdmin({ path: { id }, throwOnError: true }).then(
        (r) => r.data,
      ),
    onSuccess: invalidateForms,
  });

  return { forms: data ?? NO_FORMS, isLoading, isError, deleteForm };
}

export type FormOption = { id: number; title: string };

export function useFormOptions(): {
  options: FormOption[];
  isLoading: boolean;
  isError: boolean;
} {
  const { data, isLoading, isError } = useFormsQuery();
  const forms = data ?? NO_FORMS;
  const options = useMemo(
    () =>
      forms.map((form) => ({
        id: form.id,
        // Every picker renders this as `{title} (#{id})`, so the fallback for
        // a form saved without one must not repeat the id back.
        title: form.title || "Untitled",
      })),
    [forms],
  );
  return { options, isLoading, isError };
}

export enum ResponseCountStatus {
  Pending = "pending",
  Error = "error",
  Ready = "ready",
}

export type FormResponseCounts = {
  byForm: Record<number, number>;
  /** Per form, so a form whose batch already failed stops reading as pending
   * while a later batch is still in flight. */
  statusByForm: Record<number, ResponseCountStatus>;
};

function statusOf(
  result: UseQueryResult<FormResponseCountDto[]>,
): ResponseCountStatus {
  if (result.isError) return ResponseCountStatus.Error;
  return result.data ? ResponseCountStatus.Ready : ResponseCountStatus.Pending;
}

// The endpoint returns one row per requested id, zeroes included, so a count
// stays absent from byForm only while its batch is unresolved. Statuses are
// keyed off the ids each batch was built from, since an unresolved batch
// carries no rows to read its ids back out of.
function countsCombiner(batches: number[][]) {
  return (
    results: UseQueryResult<FormResponseCountDto[]>[],
  ): FormResponseCounts => {
    const byForm: Record<number, number> = {};
    const statusByForm: Record<number, ResponseCountStatus> = {};
    results.forEach((result, index) => {
      const status = statusOf(result);
      for (const formId of batches[index] ?? []) statusByForm[formId] = status;
      for (const { formId, count } of result.data ?? []) byForm[formId] = count;
    });
    return { byForm, statusByForm };
  };
}

export function useFormResponseCountsAdmin(
  formIds: readonly number[],
): FormResponseCounts {
  // Sorted so the query key depends on which forms are counted, not on the
  // order the list endpoint happened to return them in.
  const batches = useMemo(
    () =>
      chunk(
        [...formIds].sort((a, b) => a - b),
        FORM_RESPONSES_BY_FORMS_MAX_BATCH,
      ),
    [formIds],
  );
  // Memoized on the batches so react-query keeps memoizing the combined
  // result; rebuilt inline, every consumer of byForm rebuilds with it.
  const combine = useMemo(() => countsCombiner(batches), [batches]);

  return useQueries({
    queries: batches.map((ids) => ({
      queryKey: queryKeys.formResponseCountsAdmin(ids),
      queryFn: () =>
        tasksGetFormResponseCountsAdmin({
          body: { formIds: ids },
          throwOnError: true,
        }).then((response) => response.data),
      staleTime: FORMS_STALE_TIME,
    })),
    combine,
  });
}
