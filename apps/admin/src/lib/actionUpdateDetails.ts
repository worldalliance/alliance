import {
  CONTRIBUTION_FORMULA_KEY,
  type ContributionFormula,
} from "@alliance/common/forms/contribution-formula";
import { R } from "@alliance/common/result";
import type {
  ActionUpdateNotificationMode,
  ActionUpdateNotifyType,
  ActionUpdateRecognitionMode,
  AdminActionUpdateDto,
  UpdateActionUpdateDto,
} from "@alliance/shared/client";
import { parseContributionFormula } from "@alliance/shared/parsed-dtos";

export type RecognitionMode = ActionUpdateRecognitionMode;

const RECOGNITION_MODE: Record<
  ActionUpdateNotificationMode,
  RecognitionMode | null
> = {
  legacy: null,
  normal: "normal",
  retrospective: "retrospective",
};

export const recognitionModeOf = (
  mode: ActionUpdateNotificationMode,
): RecognitionMode | null => RECOGNITION_MODE[mode];

export type ContributionFormulas = {
  contributionFormula: ContributionFormula | null;
  retrospectiveContributionFormula: ContributionFormula | null;
};

export type ActionUpdateForm = {
  title: string;
  shortNotifString: string;
  notifyType: ActionUpdateNotifyType;
  tagId: string;
  date: string;
  associatedEventId: string;
  notificationMode: ActionUpdateNotificationMode;
  /** null when a saved formula can't be read, so saving leaves both alone. */
  formulas: ContributionFormulas | null;
};

const readFormulas = (update: AdminActionUpdateDto) =>
  R.flatMap(parseContributionFormula(update.contributionFormula), (normal) =>
    R.map(
      parseContributionFormula(update.retrospectiveContributionFormula),
      (retrospective): ContributionFormulas => ({
        contributionFormula: normal,
        retrospectiveContributionFormula: retrospective,
      }),
    ),
  );

export const activeFormula = (
  formulas: ContributionFormulas,
  mode: RecognitionMode,
): ContributionFormula | null => formulas[CONTRIBUTION_FORMULA_KEY[mode]];

export const withActiveFormula = (params: {
  formulas: ContributionFormulas;
  mode: RecognitionMode;
  formula: ContributionFormula;
}): ContributionFormulas => ({
  ...params.formulas,
  [CONTRIBUTION_FORMULA_KEY[params.mode]]: params.formula,
});

export const formOf = (update: AdminActionUpdateDto): ActionUpdateForm => ({
  title: update.title,
  shortNotifString: update.shortNotifString,
  notifyType: update.notifyType,
  tagId: update.tag?.id ?? "",
  date: update.date,
  associatedEventId: update.associatedEventId
    ? String(update.associatedEventId)
    : "",
  notificationMode: update.notificationMode,
  formulas: R.unwrapOr(readFormulas(update), null),
});

export const detailsBody = (form: ActionUpdateForm): UpdateActionUpdateDto => {
  const mode = recognitionModeOf(form.notificationMode);
  return {
    title: form.title,
    shortNotifString: form.shortNotifString,
    notifyType: form.notifyType,
    date: form.date,
    tagId: form.notifyType === "tag" ? form.tagId || null : null,
    associatedEventId: form.associatedEventId
      ? Number(form.associatedEventId)
      : null,
    ...(mode && { notificationMode: mode, ...form.formulas }),
  };
};

// The notification carries `shortNotifString` and goes to the saved audience,
// so an unsaved edit to either would send something other than what's on
// screen.
export const notifyBlockedReasonOf = (params: {
  notifyType: ActionUpdateNotifyType;
  formulasReadable: boolean;
  hasUnsavedDetails: boolean;
  hasBody: boolean;
}): string | null => {
  if (params.notifyType === "none") {
    return "Pick an audience and save to enable sending.";
  }
  if (!params.formulasReadable) {
    return "A saved contribution formula can't be read here.";
  }
  if (params.hasUnsavedDetails) {
    return "Save your changes before sending.";
  }
  if (!params.hasBody) {
    return "Write the update body on the Content tab first.";
  }
  return null;
};

export const checkBlockedReasonOf = (params: {
  notifyType: ActionUpdateNotifyType;
  hasUnsavedDetails: boolean;
}): string | null => {
  if (params.notifyType === "none") {
    return "Pick an audience and save to check recipients.";
  }
  if (params.hasUnsavedDetails) {
    return "Save your changes before checking.";
  }
  return null;
};
