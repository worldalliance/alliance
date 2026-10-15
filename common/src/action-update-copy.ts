import {
  DefaultAbbrMarkerOptions,
  SentenceSplitterSyntax,
  split,
} from "sentence-splitter";
import { z } from "zod";
import type { ContributionFormulaMode } from "./forms/contribution-formula";
import { nameParts } from "./nameParts";
import { R, type Result } from "./result";

/** A: the member's own contribution. B: the collective result alone. */
export enum RecognitionBranch {
  A = "a",
  B = "b",
}

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
  /** Plain text; escape before it reaches HTML. */
  emailBody: z.string(),
});
export type RecognitionCopy = z.infer<typeof recognitionCopySchema>;

const asSentence = (text: string) =>
  /[.!?]["'”’)\]]*$/.test(text) ? text : `${text}.`;

// Civic copy names these and dotted initialisms like "H.R." mid-sentence, and
// the default list would end a subject at them. One that does end a sentence
// keeps the next one too.
const SUBJECT_LANGUAGE = {
  ...DefaultAbbrMarkerOptions.language,
  PREPOSITIVE_ABBREVIATIONS: [
    ...DefaultAbbrMarkerOptions.language.PREPOSITIVE_ABBREVIATIONS,
    "Prop.",
    "No.",
  ],
};
const ENDS_IN_INITIALISM = /(?:^|\s)(?:\p{Lu}\.){2,}["'”’)\]]*\s*$/u;
// sentence-splitter reads every "5." as a list index, so it never ends a
// sentence after a number.
const ENDS_AFTER_NUMBER = /^.*?\S\s+\S*\d\.["'”’)\]]*(?=\s+\p{Lu})/su;

export function firstSentence(text: string): string {
  let sentence = "";
  for (const node of split(text, {
    AbbrMarker: { language: SUBJECT_LANGUAGE },
  })) {
    sentence += node.raw;
    if (
      node.type === SentenceSplitterSyntax.Sentence &&
      !ENDS_IN_INITIALISM.test(node.raw)
    )
      break;
  }
  return ENDS_AFTER_NUMBER.exec(sentence)?.[0] ?? sentence.trim();
}

export function weeksAgoLead(weeksAgo: number): string {
  if (weeksAgo < 1) return "Recently";
  if (weeksAgo === 1) return "1 week ago";
  return `${weeksAgo} weeks ago`;
}

export const collectiveEmailSubject = (allianceResult: string) =>
  firstSentence(allianceResult);

/**
 * Branch A's content body, the same on every channel, and its email subject.
 * The subject comes from the template's own first sentence, so only the
 * authored result is split, never a member's contribution.
 */
export function recognitionBody(params: {
  mode: ContributionFormulaMode;
  contribution: string;
  allianceResult: string;
  /** `weeksAgoLead`'s text, read in retrospective mode. */
  weeksAgoText: string;
}): { body: string; subject: string } {
  const { mode, contribution, allianceResult, weeksAgoText } = params;
  switch (mode) {
    case "normal":
      return {
        body: asSentence(`Your ${contribution} led to ${allianceResult}`),
        subject: asSentence(
          `Your ${contribution} led to ${collectiveEmailSubject(allianceResult)}`,
        ),
      };
    case "retrospective": {
      const subject = asSentence(`${weeksAgoText} you ${contribution}`);
      return { body: `${subject} ${asSentence(allianceResult)}`, subject };
    }
    default:
      throw new Error(`unknown recognition mode: ${mode satisfies never}`);
  }
}

export type RecognitionMessage =
  | { branch: RecognitionBranch.A; body: string; subject: string }
  | { branch: RecognitionBranch.B; allianceResult: string };

/**
 * The inbox labels every entry "Action update:", so branch B's entry leaves
 * out the "Update:" its push and text lead with.
 */
export function recognitionCopy(params: {
  message: RecognitionMessage;
  recipientName: string;
  link: string;
}): RecognitionCopy {
  const { message, recipientName, link } = params;
  const { firstname } = nameParts(recipientName);
  const channels = (params: {
    content: string;
    headline: string;
    subject: string;
  }) => ({
    push: params.headline,
    sms: `${params.headline} ${link}`,
    emailSubject: params.subject,
    emailBody: `Hi ${firstname},\n${params.content}\n${link}`,
  });
  switch (message.branch) {
    case RecognitionBranch.A:
      return {
        inApp: message.body,
        ...channels({
          content: message.body,
          headline: message.body,
          subject: message.subject,
        }),
      };
    case RecognitionBranch.B:
      return {
        inApp: message.allianceResult,
        ...channels({
          content: message.allianceResult,
          headline: `Update: ${message.allianceResult}`,
          subject: collectiveEmailSubject(message.allianceResult),
        }),
      };
    default:
      throw new Error(`unknown branch: ${message satisfies never}`);
  }
}
