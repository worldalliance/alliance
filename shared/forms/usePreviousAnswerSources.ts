import { collectSourceFormIds } from "@alliance/common/forms/form-conditions";
import {
  isDisplayBlock,
  isQuestionField,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import { useCallback, useId, useMemo } from "react";
import {
  tasksGetForm,
  tasksGetFormResponsesAdmin,
  tasksGetMyFormResponse,
} from "../client";
import { collectManualSourceFormIds } from "../formrenderer";
import { completedFormSchema } from "./formulaChoices";
import { openFormQueryOptions } from "./openFormQueryOptions";

type SourceReader = { previewId: string | null; signedIn: boolean };

type PreviousAnswerSource = {
  schema: FormSchema | null;
  answers: Record<string, unknown> | null;
};

const readSourceSchema = async (formId: number) => {
  try {
    const response = await tasksGetForm({ path: { id: formId } });
    // Stored jsonb, written by a builder that validated it; nothing
    // re-checks it on the way back in.
    const stored: unknown = response.data?.schema;
    return stored ? (stored as FormSchema) : null;
  } catch {
    // Source form deleted or not visible to this user.
    return null;
  }
};

const readSourceResponse = async (
  formId: number,
  { previewId, signedIn }: SourceReader,
) => {
  if (previewId !== null) {
    const { data } = await tasksGetFormResponsesAdmin({
      path: { id: formId },
      throwOnError: true,
    });
    return (
      data.find((candidate) => String(candidate.user?.id) === previewId) ?? null
    );
  }
  if (!signedIn) return null;
  const { data, error, response } = await tasksGetMyFormResponse({
    path: { id: formId },
    throwOnError: false,
  });
  // A 404 is a member who hasn't submitted the source form.
  if (error && response.status !== 404) throw error;
  return data ?? null;
};

const readSource = async (
  formId: number,
  reader: SourceReader,
): Promise<PreviousAnswerSource> => {
  const [schema, response] = await Promise.all([
    readSourceSchema(formId),
    readSourceResponse(formId, reader),
  ]);
  return {
    schema: schema && completedFormSchema(schema, response ?? undefined),
    answers: response && (response.answers ?? {}),
  };
};

/**
 * The schemas and the user's answers for every form this one reads back:
 * `previousAnswer` display blocks, answer sources a variable or condition
 * names, and a list's prefill source.
 */
export function usePreviousAnswerSources(args: {
  schema: FormSchema;
  /** Admin preview: read this user's responses rather than the caller's. */
  previewUserId?: string | number | null;
  /** A guest has no responses to read. */
  signedIn: boolean;
}): {
  previousAnswerSchemas: Record<number, FormSchema>;
  previousAnswerData: Record<number, Record<string, unknown>>;
  /**
   * Stays set while any read has failed, until it loads again, so nothing is
   * judged by answers it lacks.
   */
  previousAnswersPending: boolean;
} {
  const { schema, previewUserId, signedIn } = args;

  const sourceFormIds = useMemo(() => {
    const ids = new Set<number>();
    for (const page of schema.pages) {
      for (const element of page.fields) {
        if (isDisplayBlock(element) && element.kind === "previousAnswer") {
          if (element.sourceFormId) {
            ids.add(element.sourceFormId);
          }
          for (const id of collectManualSourceFormIds(element)) {
            ids.add(id);
          }
        }
        if (
          isQuestionField(element) &&
          element.kind === "list" &&
          element.prefillFromPreviousAnswer?.sourceFormId
        ) {
          ids.add(element.prefillFromPreviousAnswer.sourceFormId);
        }
      }
    }
    for (const id of collectSourceFormIds(schema)) {
      ids.add(id);
    }
    return Array.from(ids);
  }, [schema]);

  // Each open form loads its own sources, so a form opened later never shows
  // answers another open form loaded before a submission.
  const instance = useId();
  const previewId =
    previewUserId === undefined || previewUserId === null
      ? null
      : String(previewUserId);

  const combine = useCallback(
    (results: UseQueryResult<PreviousAnswerSource, Error>[]) => {
      const previousAnswerSchemas: Record<number, FormSchema> = {};
      const previousAnswerData: Record<number, Record<string, unknown>> = {};
      for (const [index, { data }] of results.entries()) {
        const formId = sourceFormIds[index];
        if (data?.schema) previousAnswerSchemas[formId] = data.schema;
        if (data?.answers) previousAnswerData[formId] = data.answers;
      }
      return {
        previousAnswerSchemas,
        previousAnswerData,
        previousAnswersPending: results.some((result) => !result.isSuccess),
      };
    },
    [sourceFormIds],
  );

  return useQueries({
    queries: sourceFormIds.map((formId) => ({
      queryKey: ["previousAnswerSource", instance, previewId, signedIn, formId],
      queryFn: () =>
        readSource(formId, { previewId, signedIn }).catch((error: unknown) => {
          console.error(`Failed to load answers from form ${formId}`, error);
          throw error;
        }),
      ...openFormQueryOptions,
    })),
    combine,
  });
}
