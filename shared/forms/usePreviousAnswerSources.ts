import { collectSourceFormIds } from "@alliance/common/forms/form-conditions";
import {
  isDisplayBlock,
  isQuestionField,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import { R } from "@alliance/common/result";
import { useEffect, useMemo, useState } from "react";
import {
  tasksGetForm,
  tasksGetFormResponsesAdmin,
  tasksGetMyFormResponse,
} from "../client";
import { collectManualSourceFormIds } from "../formrenderer";
import { completedFormSchema } from "./formulaChoices";

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
  /** Stays set after a fetch fails, so nothing is judged by answers it lacks. */
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

  const [previousAnswerSchemas, setPreviousAnswerSchemas] = useState<
    Record<number, FormSchema>
  >({});
  const [previousAnswerData, setPreviousAnswerData] = useState<
    Record<number, Record<string, unknown>>
  >({});
  const loadKey = `${sourceFormIds.join(",")}|${previewUserId ?? ""}|${signedIn}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    if (sourceFormIds.length === 0) {
      setPreviousAnswerSchemas({});
      setPreviousAnswerData({});
      setLoadedKey(null);
      return;
    }

    const previewId =
      previewUserId === undefined || previewUserId === null
        ? null
        : String(previewUserId);

    let cancelled = false;
    void (async () => {
      const schemaEntries = await Promise.all(
        sourceFormIds.map(async (formId) => {
          try {
            const response = await tasksGetForm({ path: { id: formId } });
            // Stored jsonb, written by a builder that validated it; nothing
            // re-checks it on the way back in.
            const stored: unknown = response.data?.schema;
            return stored ? ([formId, stored as FormSchema] as const) : null;
          } catch {
            // Source form deleted or not visible to this user.
            return null;
          }
        }),
      );
      if (cancelled) return;

      const schemas: Record<number, FormSchema> = {};
      for (const entry of schemaEntries) {
        if (entry) {
          schemas[entry[0]] = entry[1];
        }
      }

      const dataEntries = await Promise.all(
        sourceFormIds.map(async (formId) => {
          if (previewId !== null) {
            const sent = await R.fromPromise(
              tasksGetFormResponsesAdmin({
                path: { id: formId },
                throwOnError: false,
              }),
            );
            if (!sent.ok || sent.value.error) return R.failure(formId);
            const match = sent.value.data.find(
              (candidate) => String(candidate.user?.id) === previewId,
            );
            return R.success(match ? ([formId, match] as const) : null);
          }
          if (!signedIn) return R.success(null);
          const sent = await R.fromPromise(
            tasksGetMyFormResponse({
              path: { id: formId },
              throwOnError: false,
            }),
          );
          if (!sent.ok) return R.failure(formId);
          const { data: response, error } = sent.value;
          // A 404 is a member who hasn't submitted the source form.
          if (error && sent.value.response.status !== 404) {
            return R.failure(formId);
          }
          return R.success(response ? ([formId, response] as const) : null);
        }),
      );
      if (cancelled) return;

      const data: Record<number, Record<string, unknown>> = {};
      for (const loaded of dataEntries) {
        const entry = loaded.ok ? loaded.value : null;
        if (entry) {
          data[entry[0]] = entry[1].answers ?? {};
          const sourceSchema = schemas[entry[0]];
          if (sourceSchema) {
            schemas[entry[0]] = completedFormSchema(sourceSchema, entry[1]);
          }
        }
      }
      setPreviousAnswerSchemas(schemas);
      setPreviousAnswerData(data);
      if (dataEntries.every((loaded) => loaded.ok)) setLoadedKey(loadKey);
    })();

    return () => {
      cancelled = true;
    };
  }, [sourceFormIds, previewUserId, signedIn, loadKey]);

  return {
    previousAnswerSchemas,
    previousAnswerData,
    previousAnswersPending: sourceFormIds.length > 0 && loadedKey !== loadKey,
  };
}
