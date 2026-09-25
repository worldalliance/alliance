import { ExceptionEvent } from "@alliance/common/analytics";
import { R, type Result } from "@alliance/common/result";
import {
  tasksSubmitFollowUpForm,
  type FollowUpFormDto,
  type SubmitFormDto,
} from "../client";
import { computeFormStorageKey } from "../formrenderer";
import { captureException } from "./analytics";

export const followUpPersistKey = (followUpFormId: number): string =>
  `follow-up-${followUpFormId}`;

export const followUpDraftStorageKey = ({
  formId,
  followUpFormId,
}: {
  formId: number;
  followUpFormId: number;
}): string =>
  computeFormStorageKey({
    formId,
    instanceId: followUpPersistKey(followUpFormId),
  });

export function followUpFormIntro(
  followUpForm: Pick<FollowUpFormDto, "name" | "instructions">,
  formTitle: string,
) {
  const title = followUpForm.name ?? formTitle;
  const hasInstructions =
    followUpForm.instructions != null &&
    followUpForm.instructions.trim() !== "";
  return { title, hasInstructions, shown: hasInstructions || !!title };
}

export async function submitFollowUpForm({
  followUpFormId,
  actionId,
  data,
}: {
  followUpFormId: number;
  actionId: number;
  data: SubmitFormDto;
}): Promise<Result<void, unknown>> {
  const response = await tasksSubmitFollowUpForm({
    path: { followUpFormId },
    body: {
      answers: data.answers,
      formSnapshotId: data.formSnapshotId,
      visibilityValidatorResults: data.visibilityValidatorResults,
      deviceType: data.deviceType,
      publicAnswers: data.publicAnswers,
      phDistinctId: data.phDistinctId,
      sessionReplayUrl: data.sessionReplayUrl,
      sid: data.sid,
    },
  });
  if (response.response.ok) return R.success(undefined);
  console.error(response.error);
  captureException(ExceptionEvent.FollowUpFormSubmitError, response.error, {
    actionId,
    followUpFormId,
  });
  return R.failure(response.error);
}
