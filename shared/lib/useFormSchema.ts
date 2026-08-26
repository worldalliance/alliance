import type { AnyField } from "@alliance/common/forms/form-schema";
import { storedQuestionFields } from "@alliance/common/forms/stored-schema";
import {
  skipToken,
  useQueries,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { tasksGetForm } from "../client";
import { queryKeys } from "./queryKeys";

type FormQuestionFields = {
  formId: number;
  fields: readonly AnyField[];
};

// A form's fields only move when someone saves that form, and every save
// invalidates this key through useInvalidateFormsAdmin. The window is what a
// save in another tab costs us, not what staleness costs the builder.
const FORM_FIELDS_STALE_TIME = 5 * 60 * 1000;

const NO_FIELDS: readonly AnyField[] = [];

/** The form came back; what it stores under `schema` could not be read. */
export class UnreadableFormSchemaError extends Error {
  constructor(formId: number, cause: unknown) {
    super(`Form ${formId} has an unreadable schema`, { cause });
    this.name = "UnreadableFormSchemaError";
  }
}

function formQuestionFieldsQuery(formId: number) {
  return {
    queryKey: queryKeys.formQuestionFieldsAdmin(formId),
    queryFn: async (): Promise<FormQuestionFields> => {
      const response = await tasksGetForm({
        path: { id: formId },
        throwOnError: true,
      });
      // Read leniently: an element whose kind the current schema no longer
      // knows is dropped, where a strict parse would empty the whole picker.
      const fields = storedQuestionFields(response.data.schema);
      if (!fields.ok) {
        throw new UnreadableFormSchemaError(formId, fields.error);
      }
      return { formId, fields: fields.value };
    },
    staleTime: FORM_FIELDS_STALE_TIME,
    // A condition left pointing at a deleted form 404s every time. Retrying
    // only delays the empty picker the caller has to explain.
    retry: false,
  };
}

export function useFormQuestionFields(formId: number | undefined): {
  fields: readonly AnyField[];
  status: FormFieldsStatus;
} {
  // 0 is the builder's "no form picked yet" sentinel, and asking the server
  // for form 0 only 404s.
  const result = useQuery(
    formId
      ? formQuestionFieldsQuery(formId)
      : {
          queryKey: queryKeys.formQuestionFieldsAdmin(null),
          queryFn: skipToken,
        },
  );
  return { fields: result.data?.fields ?? NO_FIELDS, status: statusOf(result) };
}

/** Both failures leave the picker with no fields; they differ only in what it
 * can tell the admin to do about it. */
export enum FormFieldsStatus {
  Pending = "pending",
  LoadFailed = "loadFailed",
  SchemaUnreadable = "schemaUnreadable",
  Ready = "ready",
}

type FormQuestionFieldsMap = {
  byForm: Record<number, readonly AnyField[]>;
  /** Per form, so a caller showing one form at a time names the right one. */
  statusByForm: Record<number, FormFieldsStatus>;
};

// Only a failure with nothing cached behind it is worth reporting. A refetch
// that fails once the fields are already cached leaves the picker a full list
// to render, and "it may have been deleted" alongside it reads as a lie.
function statusOf(
  result: UseQueryResult<FormQuestionFields>,
): FormFieldsStatus {
  if (result.data) return FormFieldsStatus.Ready;
  if (result.isError) {
    return result.error instanceof UnreadableFormSchemaError
      ? FormFieldsStatus.SchemaUnreadable
      : FormFieldsStatus.LoadFailed;
  }
  return FormFieldsStatus.Pending;
}

// Built from the ids the queries were made from, since a pending or failed
// result carries no data to read its form id back out of.
function fieldsCombiner(formIds: readonly number[]) {
  return (
    results: UseQueryResult<FormQuestionFields>[],
  ): FormQuestionFieldsMap => {
    const byForm: Record<number, readonly AnyField[]> = {};
    const statusByForm: Record<number, FormFieldsStatus> = {};
    results.forEach((result, index) => {
      const formId = formIds[index];
      if (formId === undefined) return;
      if (result.data) byForm[formId] = result.data.fields;
      statusByForm[formId] = statusOf(result);
    });
    return { byForm, statusByForm };
  };
}

export function useFormQuestionFieldsMap(
  formIds: readonly number[],
): FormQuestionFieldsMap {
  const activeIds = useMemo(
    () => formIds.filter((formId) => formId > 0),
    [formIds],
  );
  const queries = useMemo(
    () => activeIds.map((formId) => formQuestionFieldsQuery(formId)),
    [activeIds],
  );
  // Memoized on the ids so react-query keeps memoizing the combined result;
  // rebuilt inline, byForm changes identity on every render and every callback
  // keyed on it downstream rebuilds with it.
  const combine = useMemo(() => fieldsCombiner(activeIds), [activeIds]);
  return useQueries({ queries, combine });
}

/** Reads the shared query cache without ever fetching. */
export function useFormQuestionFieldsPeek(): (
  formId: number,
) => readonly AnyField[] | undefined {
  const queryClient = useQueryClient();
  return useMemo(
    () => (formId: number) =>
      queryClient.getQueryData<FormQuestionFields>(
        queryKeys.formQuestionFieldsAdmin(formId),
      )?.fields,
    [queryClient],
  );
}
