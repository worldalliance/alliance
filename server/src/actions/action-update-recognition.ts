import {
  readGroupResults,
  RecognitionGroup,
  type GroupResults,
} from "@alliance/common/action-update-copy";
import { R, type Result } from "@alliance/common/result";
import {
  ActionUpdateNotificationMode,
  type ActionUpdate,
} from "./entities/action-update.entity";

const USES_RECOGNITION: Record<ActionUpdateNotificationMode, boolean> = {
  [ActionUpdateNotificationMode.Legacy]: false,
  [ActionUpdateNotificationMode.Normal]: true,
};

export const usesRecognition = (mode: ActionUpdateNotificationMode) =>
  USES_RECOGNITION[mode];

/** Each group's result, or what blocks a send. */
export function readRecognitionConfig(
  update: Pick<
    ActionUpdate,
    | "notificationMode"
    | "shortNotifString"
    | "splitCollectiveResult"
    | "nonCompleterResult"
    | "uninvolvedResult"
  >,
): Result<GroupResults, string> {
  if (!usesRecognition(update.notificationMode)) {
    return R.failure("This update uses the legacy notification copy.");
  }
  return readGroupResults({
    split: update.splitCollectiveResult,
    completed: update.shortNotifString,
    didNotComplete: update.nonCompleterResult,
    uninvolved: update.uninvolvedResult,
  });
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
  completed: boolean;
  participant: boolean;
};

export type RecognitionPlan = {
  userId: number;
  name: string;
  completed: boolean;
  allianceResult: string;
};

/** Leaves out every recipient whose group has no result. */
export function planRecognition(params: {
  results: GroupResults;
  recipients: readonly RecognitionRecipient[];
}): RecognitionPlan[] {
  return params.recipients.flatMap(
    ({ userId, name, completed, participant }) => {
      const allianceResult =
        params.results[recognitionGroupOf({ completed, participant })];
      return allianceResult === null
        ? []
        : [{ userId, name, completed, allianceResult }];
    },
  );
}
