import type { ActionDto } from "@alliance/shared/client";

export enum ActionStatusBucket {
  Active = "active",
  Pending = "pending",
  Draft = "draft",
  Onboarding = "onboarding",
  Completed = "completed",
}

export const ACTION_STATUS_BUCKET_LABELS: Record<ActionStatusBucket, string> = {
  [ActionStatusBucket.Active]: "Active",
  [ActionStatusBucket.Pending]: "Pending",
  [ActionStatusBucket.Draft]: "Draft",
  [ActionStatusBucket.Onboarding]: "Onboarding",
  [ActionStatusBucket.Completed]: "Completed",
};

export const actionStatusBucket = (
  action: Pick<ActionDto, "status" | "onboarding">,
): ActionStatusBucket => {
  if (action.onboarding) {
    return ActionStatusBucket.Onboarding;
  }
  switch (action.status) {
    case "draft":
      return ActionStatusBucket.Draft;
    case "member_action":
      return ActionStatusBucket.Active;
    case "completed":
      return ActionStatusBucket.Completed;
    case "planned":
    case "office_action":
    case "resolution":
    case "failed":
    case "abandoned":
      return ActionStatusBucket.Pending;
    default:
      throw new Error(
        `unknown action status: ${action.status satisfies never}`,
      );
  }
};
