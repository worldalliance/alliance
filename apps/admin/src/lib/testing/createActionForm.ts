import type { CreateActionDto } from "@alliance/shared/client";

export const createActionForm = (
  overrides: Partial<CreateActionDto> = {},
): CreateActionDto => ({
  name: "Call your rep",
  category: [],
  body: "",
  shortDescription: "",
  isContractSigningAction: false,
  visibilityMode: "all_members",
  onboarding: false,
  optional: false,
  preventCompletion: false,
  publicOnly: false,
  shouldCompleteAfterDeadline: false,
  isForumParticipationAction: false,
  ...overrides,
});
