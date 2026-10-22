import {
  DefaultAbbrMarkerOptions,
  SentenceSplitterSyntax,
  split,
} from "sentence-splitter";
import { z } from "zod";
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
  /** Plain text; escape before it reaches HTML. */
  emailBody: z.string(),
});
export type RecognitionCopy = z.infer<typeof recognitionCopySchema>;

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

export const collectiveEmailSubject = (allianceResult: string) =>
  firstSentence(allianceResult);

/**
 * The inbox labels every entry "Action update:", so the entry leaves out the
 * "Update:" its push and text lead with.
 */
export function recognitionCopy(params: {
  allianceResult: string;
  recipientName: string;
  link: string;
}): RecognitionCopy {
  const { allianceResult, recipientName, link } = params;
  const { firstname } = nameParts(recipientName);
  const headline = `Update: ${allianceResult}`;
  return {
    inApp: allianceResult,
    push: headline,
    sms: `${headline} ${link}`,
    emailSubject: collectiveEmailSubject(allianceResult),
    emailBody: `Hi ${firstname},\n${allianceResult}\n${link}`,
  };
}
