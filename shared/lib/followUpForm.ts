import { isFollowUpFormActive } from "@alliance/common/followUpForm";
import type { ActionDto, FollowUpFormDto } from "../client";
import { computeFormStorageKey } from "../forms/formDrafts";
import { hasViewerCompletedAction } from "./actionUtils";

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

export function getActiveFollowUpForms(
  action: Pick<ActionDto, "viewer" | "userRelation" | "followUpForms">,
): FollowUpFormDto[] {
  if (!hasViewerCompletedAction(action)) return [];
  return (action.followUpForms ?? []).filter(isFollowUpFormActive);
}

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
