import {
  CONTRIBUTION_FORMULA_KEY,
  contributionFormulaSchema,
  type ContributionFormula,
} from "@alliance/common/forms/contribution-formula";
import { readStoredFormAnswers } from "@alliance/common/forms/form-responses";
import {
  readableVariableInputFields,
  variableInputFieldsById,
} from "@alliance/common/forms/form-schema";
import { storedQuestionFields } from "@alliance/common/forms/stored-schema";
import {
  evaluateVariableText,
  prepareFormula,
} from "@alliance/common/forms/variable-evaluation";
import { compileVariableExpression } from "@alliance/common/forms/variable-expression";
import { nameParts } from "@alliance/common/nameParts";
import { R, type Result } from "@alliance/common/result";
import { milliseconds } from "date-fns";
import {
  DefaultAbbrMarkerOptions,
  SentenceSplitterSyntax,
  split,
} from "sentence-splitter";
import { ExperimentArm } from "src/notifs/entities/experiment-assignment.entity";
import {
  RecognitionBranch,
  type RecognitionCopy,
} from "./entities/action-update-exposure.entity";
import {
  ActionUpdateNotificationMode,
  type ActionUpdate,
} from "./entities/action-update.entity";

export type RecognitionMode = Exclude<
  ActionUpdateNotificationMode,
  ActionUpdateNotificationMode.Legacy
>;

export function recognitionModeOf(
  mode: ActionUpdateNotificationMode,
): RecognitionMode | null {
  switch (mode) {
    case ActionUpdateNotificationMode.Legacy:
      return null;
    case ActionUpdateNotificationMode.Normal:
    case ActionUpdateNotificationMode.Retrospective:
      return mode;
    default:
      throw new Error(`unknown notification mode: ${mode satisfies never}`);
  }
}

export const RECOGNITION_MODES = Object.values(
  ActionUpdateNotificationMode,
).filter((mode) => recognitionModeOf(mode) !== null);

const FORMULA_LABEL: Record<RecognitionMode, string> = {
  [ActionUpdateNotificationMode.Normal]: "contribution",
  [ActionUpdateNotificationMode.Retrospective]: "retrospective contribution",
};

export type RecognitionConfig = {
  mode: RecognitionMode;
  formula: ContributionFormula;
  allianceResult: string;
};

/** The selected mode's settings, or every problem that blocks a send. */
export function readRecognitionConfig(
  update: Pick<
    ActionUpdate,
    | "notificationMode"
    | "contributionFormula"
    | "retrospectiveContributionFormula"
    | "shortNotifString"
  >,
): Result<RecognitionConfig, string[]> {
  const mode = recognitionModeOf(update.notificationMode);
  if (mode === null) {
    return R.failure(["This update uses the legacy notification copy."]);
  }
  const problems: string[] = [];
  const allianceResult = update.shortNotifString.trim();
  if (!allianceResult) {
    problems.push("Write the collective result.");
  }
  const key = CONTRIBUTION_FORMULA_KEY[mode];
  const label = FORMULA_LABEL[mode];
  const formula = readContributionFormula(update[key], label);
  if (!formula.ok) {
    problems.push(formula.error);
  }
  return formula.ok && problems.length === 0
    ? R.success({ mode, formula: formula.value, allianceResult })
    : R.failure(problems);
}

function readContributionFormula(
  raw: unknown,
  label: string,
): Result<ContributionFormula, string> {
  if (raw === null) {
    return R.failure(`Write the ${label} formula.`);
  }
  const parsed = contributionFormulaSchema.safeParse(raw);
  if (!parsed.success) {
    return R.failure(
      `The ${label} formula is malformed: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`,
    );
  }
  const compiled = compileVariableExpression(
    parsed.data.formula,
    new Set(Object.keys(parsed.data.inputs)),
  );
  return compiled.ok
    ? R.success(parsed.data)
    : R.failure(`The ${label} formula doesn't compile: ${compiled.error}`);
}

export type CompletionAnswers = {
  answers: unknown;
  /** The schema of the form version the answers were submitted against. */
  schema: unknown;
};

/** A null response stands for a completion recorded without one. */
export function evaluateContribution(
  formula: ContributionFormula,
  response: CompletionAnswers | null,
): Result<string, string> {
  const answers = response ? readStoredFormAnswers(response.answers) : null;
  if (answers && !answers.ok) {
    return R.failure("Their answers can't be read.");
  }
  const fields = response ? storedQuestionFields(response.schema) : null;
  if (fields && !fields.ok) {
    return R.failure("The form version they answered can't be read.");
  }
  const text = R.flatMap(
    prepareFormula(formula, {
      answers: answers?.value ?? {},
      fields: variableInputFieldsById(
        readableVariableInputFields(fields?.value ?? []),
      ),
    }),
    ({ node, inputs }) => evaluateVariableText(node, inputs),
  );
  if (!text.ok) return text;
  const trimmed = text.value.trim();
  return trimmed
    ? R.success(trimmed)
    : R.failure("The formula resolves to empty text.");
}

const WEEK_MS = milliseconds({ weeks: 1 });

export function wholeWeeksBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / WEEK_MS);
}

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

function weeksAgoLead(weeksAgo: number): string {
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
  mode: RecognitionMode;
  contribution: string;
  allianceResult: string;
  weeksAgo: number;
}): { body: string; subject: string } {
  const { mode, contribution, allianceResult, weeksAgo } = params;
  switch (mode) {
    case ActionUpdateNotificationMode.Normal:
      return {
        body: asSentence(`Your ${contribution} led to ${allianceResult}`),
        subject: asSentence(
          `Your ${contribution} led to ${collectiveEmailSubject(allianceResult)}`,
        ),
      };
    case ActionUpdateNotificationMode.Retrospective: {
      const subject = asSentence(
        `${weeksAgoLead(weeksAgo)} you ${contribution}`,
      );
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

export type RecognitionRecipient = {
  userId: number;
  name: string;
  arm: ExperimentArm;
  completion: { completedAt: Date; response: CompletionAnswers | null } | null;
};

export type RecognitionPlan = {
  userId: number;
  name: string;
  arm: ExperimentArm;
  completed: boolean;
  contribution: string | null;
  weeksAgo: number | null;
  message: RecognitionMessage;
};

export type RecognitionMemberIssue = {
  userId: number;
  name: string;
  error: string;
};

/** Fails with every branch-A recipient whose contribution doesn't resolve. */
export function planRecognition(params: {
  config: RecognitionConfig;
  recipients: readonly RecognitionRecipient[];
  now: Date;
}): Result<RecognitionPlan[], RecognitionMemberIssue[]> {
  const { config, recipients, now } = params;
  const plans: RecognitionPlan[] = [];
  const issues: RecognitionMemberIssue[] = [];
  for (const { userId, name, arm, completion } of recipients) {
    if (completion === null || arm !== ExperimentArm.Variant) {
      plans.push({
        userId,
        name,
        arm,
        completed: completion !== null,
        contribution: null,
        weeksAgo: completion && wholeWeeksBetween(completion.completedAt, now),
        message: {
          branch: RecognitionBranch.B,
          allianceResult: config.allianceResult,
        },
      });
      continue;
    }
    const weeksAgo = wholeWeeksBetween(completion.completedAt, now);
    const contribution = evaluateContribution(
      config.formula,
      completion.response,
    );
    if (!contribution.ok) {
      issues.push({ userId, name, error: contribution.error });
      continue;
    }
    plans.push({
      userId,
      name,
      arm,
      completed: true,
      weeksAgo,
      contribution: contribution.value,
      message: {
        branch: RecognitionBranch.A,
        ...recognitionBody({
          mode: config.mode,
          contribution: contribution.value,
          allianceResult: config.allianceResult,
          weeksAgo,
        }),
      },
    });
  }
  return issues.length ? R.failure(issues) : R.success(plans);
}
