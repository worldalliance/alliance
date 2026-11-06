import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { ACTION_TEXT_FIELD_LABELS } from "../../lib/actionFieldDefs";
import { formTextPlaces } from "../../pages/action-dashboard/actionReadiness";
import { findTextIssues, TextIssueKind, type TextIssue } from "./textChecks";

export enum TextSource {
  Name = "name",
  ShortDescription = "shortDescription",
  Body = "body",
  TaskForm = "taskForm",
  VariantForm = "variantForm",
}

export const TEXT_SOURCE_LABELS: Record<TextSource, string> = {
  [TextSource.Name]: ACTION_TEXT_FIELD_LABELS.name,
  [TextSource.ShortDescription]: ACTION_TEXT_FIELD_LABELS.shortDescription,
  [TextSource.Body]: ACTION_TEXT_FIELD_LABELS.body,
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
  /** The form page or element holding the text, null when no id names it alone. */
  formElementId: string | null;
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
  type Located = Pick<
    TextFinding,
    "source" | "text" | "formId" | "formElementId"
  >;
  const formTextsOf = ({
    source,
    schema,
    formId,
  }: {
    source: TextSource;
    schema: FormSchema | null;
    formId: number | null;
  }) =>
    (schema ? formTextPlaces(schema) : []).map(
      ({ text, id }): Located => ({ source, text, formId, formElementId: id }),
    );
  const actionText = (source: TextSource, text: string): Located => ({
    source,
    text,
    formId: null,
    formElementId: null,
  });
  const texts: Located[] = [
    actionText(TextSource.Name, action.name),
    actionText(TextSource.ShortDescription, action.shortDescription),
    actionText(TextSource.Body, action.body),
    ...formTextsOf({
      source: TextSource.TaskForm,
      schema: taskFormSchema,
      formId: taskFormId,
    }),
    ...variantForms.flatMap(({ formId, schema }) =>
      formTextsOf({ source: TextSource.VariantForm, schema, formId }),
    ),
  ];
  const occurrences = new Map<string, number>();
  return texts.flatMap(({ source, text, formId, formElementId }) =>
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
        formElementId,
        text,
      };
    }),
  );
}
