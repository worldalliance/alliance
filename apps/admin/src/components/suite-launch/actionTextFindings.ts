import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { formTexts } from "../../pages/action-dashboard/actionReadiness";
import { findTextIssues, TextIssueKind, type TextIssue } from "./textChecks";

export enum TextSource {
  Name = "name",
  ShortDescription = "shortDescription",
  Body = "body",
  TaskForm = "taskForm",
  VariantForm = "variantForm",
}

export const TEXT_SOURCE_LABELS: Record<TextSource, string> = {
  [TextSource.Name]: "Name",
  [TextSource.ShortDescription]: "Short description",
  [TextSource.Body]: "Body",
  [TextSource.TaskForm]: "Task form",
  [TextSource.VariantForm]: "Variant form",
};

export type TextFinding = Pick<TextIssue, "kind" | "start" | "end"> & {
  /** Unique per finding, and survives edits elsewhere in the text. */
  key: string;
  /** What a dismissal records: `key`, except that every misspelling of the same word shares one, so one dismissal covers them all. */
  dismissKey: string;
  actionId: number;
  source: TextSource;
  /** The form to edit to fix it, null for the action's own text. */
  formId: number | null;
  text: string;
};

const CONTEXT_CHARS = 20;

export const findingContext = (
  finding: Pick<TextFinding, "text" | "start" | "end">,
) => ({
  before: finding.text.slice(
    Math.max(0, finding.start - CONTEXT_CHARS),
    finding.start,
  ),
  flagged: finding.text.slice(finding.start, finding.end),
  after: finding.text.slice(finding.end, finding.end + CONTEXT_CHARS),
});

export function actionTextFindings(params: {
  action: Pick<ParsedActionDto, "id" | "name" | "shortDescription" | "body">;
  taskFormSchema: FormSchema | null;
  taskFormId?: number | null;
  variantForms?: { formId: number; schema: FormSchema }[];
  isKnownWord?: (word: string) => boolean;
}): TextFinding[] {
  const {
    action,
    taskFormSchema,
    taskFormId = null,
    variantForms = [],
    isKnownWord,
  } = params;
  const formTextsOf = (
    source: TextSource,
    schema: FormSchema | null,
    formId: number | null,
  ) =>
    (schema ? formTexts(schema) : []).map(
      (text): [TextSource, string, number | null] => [source, text, formId],
    );
  const texts: [TextSource, string, number | null][] = [
    [TextSource.Name, action.name, null],
    [TextSource.ShortDescription, action.shortDescription, null],
    [TextSource.Body, action.body, null],
    ...formTextsOf(TextSource.TaskForm, taskFormSchema, taskFormId),
    ...variantForms.flatMap(({ formId, schema }) =>
      formTextsOf(TextSource.VariantForm, schema, formId),
    ),
  ];
  const occurrences = new Map<string, number>();
  return texts.flatMap(([source, text, formId]) =>
    findTextIssues(text, isKnownWord).map((issue): TextFinding => {
      const { before, flagged, after } = findingContext({
        text,
        start: issue.start,
        end: issue.end,
      });
      const where =
        source === TextSource.VariantForm ? `${source}:${formId}` : source;
      const key = [action.id, where, issue.kind, before, flagged, after].join(
        "|",
      );
      const occurrence = occurrences.get(key) ?? 0;
      occurrences.set(key, occurrence + 1);
      const unique = `${key}|${occurrence}`;
      return {
        kind: issue.kind,
        start: issue.start,
        end: issue.end,
        key: unique,
        dismissKey:
          issue.kind === TextIssueKind.Misspelling
            ? `${issue.kind}|${issue.word}`
            : unique,
        actionId: action.id,
        source,
        formId,
        text,
      };
    }),
  );
}
