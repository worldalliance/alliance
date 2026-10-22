import type {
  ActionUpdateNotificationMode,
  ActionUpdateNotifyType,
  AdminActionUpdateDto,
  UpdateActionUpdateDto,
} from "@alliance/shared/client";
import type { CollectiveResultTexts } from "./updatePreview";

const USES_RECOGNITION: Record<ActionUpdateNotificationMode, boolean> = {
  legacy: false,
  normal: true,
};

export const usesRecognition = (mode: ActionUpdateNotificationMode) =>
  USES_RECOGNITION[mode];

export type ActionUpdateForm = CollectiveResultTexts & {
  title: string;
  notifyType: ActionUpdateNotifyType;
  tagId: string;
  date: string;
  associatedEventId: string;
  notificationMode: ActionUpdateNotificationMode;
};

export const formOf = (update: AdminActionUpdateDto): ActionUpdateForm => ({
  title: update.title,
  shortNotifString: update.shortNotifString,
  splitCollectiveResult: update.splitCollectiveResult,
  nonCompleterResult: update.nonCompleterResult ?? "",
  uninvolvedResult: update.uninvolvedResult ?? "",
  notifyType: update.notifyType,
  tagId: update.tag?.id ?? "",
  date: update.date,
  associatedEventId: update.associatedEventId
    ? String(update.associatedEventId)
    : "",
  notificationMode: update.notificationMode,
});

export const detailsBody = (form: ActionUpdateForm): UpdateActionUpdateDto => ({
  title: form.title,
  shortNotifString: form.shortNotifString,
  notifyType: form.notifyType,
  date: form.date,
  tagId: form.notifyType === "tag" ? form.tagId || null : null,
  associatedEventId: form.associatedEventId
    ? Number(form.associatedEventId)
    : null,
  ...(usesRecognition(form.notificationMode) && {
    splitCollectiveResult: form.splitCollectiveResult,
    nonCompleterResult: form.nonCompleterResult || null,
    uninvolvedResult: form.uninvolvedResult || null,
  }),
});

// The notification carries `shortNotifString` and goes to the saved audience,
// so an unsaved edit to either would send something other than what's on
// screen.
export const notifyBlockedReasonOf = (params: {
  notifyType: ActionUpdateNotifyType;
  hasUnsavedDetails: boolean;
  hasBody: boolean;
}): string | null => {
  if (params.notifyType === "none") {
    return "Pick an audience and save to enable sending.";
  }
  if (params.hasUnsavedDetails) {
    return "Save your changes before sending.";
  }
  if (!params.hasBody) {
    return "Write the update body on the Content tab first.";
  }
  return null;
};
