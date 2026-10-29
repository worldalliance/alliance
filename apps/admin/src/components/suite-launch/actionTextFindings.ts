import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { formTexts } from "../../pages/action-dashboard/actionReadiness";
import { findTextIssues, TextIssueKind, type TextIssue } from "./textChecks";

export enum TextSource {
  Name = "name",
  ShortDescription = "shortDescription",
  Body = "body",
  TaskForm = "taskForm",
}

export const TEXT_SOURCE_LABELS: Record<TextSource, string> = {
  [TextSource.Name]: "Name",
  [TextSource.ShortDescription]: "Short description",
  [TextSource.Body]: "Body",
  [TextSource.TaskForm]: "Task form",
};

export type TextFinding = Pick<TextIssue, "kind" | "start" | "end"> & {
  /** Unique per finding, and survives edits elsewhere in the text. */
  key: string;
  /** What a dismissal records: `key`, except that every misspelling of the same word shares one, so one dismissal covers them all. */
  dismissKey: string;
  actionId: number;
  source: TextSource;
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
  isKnownWord?: (word: string) => boolean;
}): TextFinding[] {
  const { action, taskFormSchema, isKnownWord } = params;
  const texts: [TextSource, string][] = [
    [TextSource.Name, action.name],
    [TextSource.ShortDescription, action.shortDescription],
    [TextSource.Body, action.body],
    ...(taskFormSchema ? formTexts(taskFormSchema) : []).map(
      (text): [TextSource, string] => [TextSource.TaskForm, text],
    ),
  ];
  const occurrences = new Map<string, number>();
  return texts.flatMap(([source, text]) =>
    findTextIssues(text, isKnownWord).map((issue): TextFinding => {
      const { before, flagged, after } = findingContext({
        text,
        start: issue.start,
        end: issue.end,
      });
      const key = [action.id, source, issue.kind, before, flagged, after].join(
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
        text,
      };
    }),
  );
}
