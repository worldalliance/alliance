import { z } from "zod";
import {
  escapeMarkdownText,
  markdownLink,
} from "./forms/display-only-markdown";
import { nameParts } from "./nameParts";
import { R, type Result } from "./result";

export enum RecognitionGroup {
  Completed = "completed",
  DidNotComplete = "did_not_complete",
  /** Not an expected participant: unassigned, away during the window, or withdrawn. */
  Uninvolved = "uninvolved",
}

/** Each group's collective result; null skips the group. */
export type GroupResults = Record<RecognitionGroup, string | null>;

export function readGroupResults(params: {
  split: boolean;
  completed: string;
  didNotComplete: string | null;
  uninvolved: string | null;
}): Result<GroupResults, string> {
  const orNull = (text: string | null) => text?.trim() || null;
  const completed = orNull(params.completed);
  if (!params.split) {
    return completed
      ? R.success({
          [RecognitionGroup.Completed]: completed,
          [RecognitionGroup.DidNotComplete]: completed,
          [RecognitionGroup.Uninvolved]: completed,
        })
      : R.failure("Write the collective result.");
  }
  const results: GroupResults = {
    [RecognitionGroup.Completed]: completed,
    [RecognitionGroup.DidNotComplete]: orNull(params.didNotComplete),
    [RecognitionGroup.Uninvolved]: orNull(params.uninvolved),
  };
  return Object.values(results).some((text) => text !== null)
    ? R.success(results)
    : R.failure("Write at least one group's result.");
}

export const recognitionCopySchema = z.strictObject({
  inApp: z.string(),
  push: z.string(),
  sms: z.string(),
  emailSubject: z.string(),
  /** Markdown. */
  emailBody: z.string(),
});
export type RecognitionCopy = z.infer<typeof recognitionCopySchema>;

/**
 * The inbox labels every entry "Action update:", so the entry leaves out the
 * "Update:" its push and text lead with.
 */
export function recognitionCopy(params: {
  allianceResult: string;
  recipientName: string;
  link: string;
  projectOrActionName: string;
  /** The update's content, as Markdown. */
  content: string;
}): RecognitionCopy {
  const { allianceResult, recipientName, link, projectOrActionName, content } =
    params;
  const { firstname } = nameParts(recipientName);
  const headline = `Update: ${allianceResult}`;
  return {
    inApp: allianceResult,
    push: headline,
    sms: `${headline} ${link}`,
    emailSubject: `Alliance progress update: ${projectOrActionName}`,
    emailBody: [
      `Hi ${escapeMarkdownText(firstname)},`,
      `Here's an update on a recent Alliance project, "${markdownLink({ text: projectOrActionName, url: link })}."`,
      escapeMarkdownText(allianceResult),
      content,
      "Best,",
      "The Alliance Team",
    ]
      .filter((paragraph) => paragraph !== "")
      .join("\n\n"),
  };
}
