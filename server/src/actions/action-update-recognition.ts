import {
  readGroupResults,
  recognitionBody,
  RecognitionBranch,
  RecognitionGroup,
  weeksAgoLead,
  type GroupResults,
  type RecognitionMessage,
} from "@alliance/common/action-update-copy";
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
import { compileVariableExpression } from "@alliance/common/forms/variable-expression-compile";
import { R, type Result } from "@alliance/common/result";
import { milliseconds } from "date-fns";
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
  results: GroupResults;
};

/** The selected mode's settings, or every problem that blocks a send. */
export function readRecognitionConfig(
  update: Pick<
    ActionUpdate,
    | "notificationMode"
    | "contributionFormula"
    | "retrospectiveContributionFormula"
    | "shortNotifString"
    | "splitCollectiveResult"
    | "nonCompleterResult"
    | "uninvolvedResult"
  >,
): Result<RecognitionConfig, string[]> {
  const mode = recognitionModeOf(update.notificationMode);
  if (mode === null) {
    return R.failure(["This update uses the legacy notification copy."]);
  }
  const problems: string[] = [];
  const results = readGroupResults({
    split: update.splitCollectiveResult,
    completed: update.shortNotifString,
    didNotComplete: update.nonCompleterResult,
    uninvolved: update.uninvolvedResult,
  });
  if (!results.ok) {
    problems.push(results.error);
  }
  const key = CONTRIBUTION_FORMULA_KEY[mode];
  const label = FORMULA_LABEL[mode];
  const formula = readContributionFormula(update[key], label);
  if (!formula.ok) {
    problems.push(formula.error);
  }
  return formula.ok && results.ok && problems.length === 0
    ? R.success({ mode, formula: formula.value, results: results.value })
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

export function recognitionGroupOf(params: {
  completed: boolean;
  participant: boolean;
}): RecognitionGroup {
  if (params.completed) return RecognitionGroup.Completed;
  return params.participant
    ? RecognitionGroup.DidNotComplete
    : RecognitionGroup.Uninvolved;
}

export type RecognitionPreviewCounts = Record<RecognitionGroup, number>;

export function countRecognitionPreview(
  recipients: readonly { completed: boolean; participant: boolean }[],
): RecognitionPreviewCounts {
  const counts: RecognitionPreviewCounts = {
    [RecognitionGroup.Completed]: 0,
    [RecognitionGroup.DidNotComplete]: 0,
    [RecognitionGroup.Uninvolved]: 0,
  };
  for (const recipient of recipients) {
    counts[recognitionGroupOf(recipient)]++;
  }
  return counts;
}

export type RecognitionRecipient = {
  userId: number;
  name: string;
  participant: boolean;
  completion: { completedAt: Date; response: CompletionAnswers | null } | null;
};

export type RecognitionPlan = {
  userId: number;
  name: string;
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

/**
 * Leaves out every recipient whose group has no result. Fails with every
 * completer whose contribution doesn't resolve.
 */
export function planRecognition(params: {
  config: RecognitionConfig;
  recipients: readonly RecognitionRecipient[];
  now: Date;
}): Result<RecognitionPlan[], RecognitionMemberIssue[]> {
  const { config, recipients, now } = params;
  const plans: RecognitionPlan[] = [];
  const issues: RecognitionMemberIssue[] = [];
  for (const { userId, name, participant, completion } of recipients) {
    const allianceResult =
      config.results[
        recognitionGroupOf({ completed: completion !== null, participant })
      ];
    if (allianceResult === null) continue;
    if (completion === null) {
      plans.push({
        userId,
        name,
        completed: false,
        contribution: null,
        weeksAgo: null,
        message: { branch: RecognitionBranch.B, allianceResult },
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
      completed: true,
      weeksAgo,
      contribution: contribution.value,
      message: {
        branch: RecognitionBranch.A,
        ...recognitionBody({
          mode: config.mode,
          contribution: contribution.value,
          allianceResult,
          weeksAgoText: weeksAgoLead(weeksAgo),
        }),
      },
    });
  }
  return issues.length ? R.failure(issues) : R.success(plans);
}
