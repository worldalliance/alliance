import type { ActionDto } from "@alliance/shared/client";

export enum ActionCategory {
  Active = "active",
  Pending = "pending",
  Draft = "draft",
  Onboarding = "onboarding",
  Completed = "completed",
}

export const ACTION_CATEGORY_LABELS: Record<ActionCategory, string> = {
  [ActionCategory.Active]: "Active",
  [ActionCategory.Pending]: "Pending",
  [ActionCategory.Draft]: "Draft",
  [ActionCategory.Onboarding]: "Onboarding",
  [ActionCategory.Completed]: "Completed",
};

export const actionCategory = (
  action: Pick<ActionDto, "status" | "onboarding">,
): ActionCategory => {
  if (action.onboarding) {
    return ActionCategory.Onboarding;
  }
  switch (action.status) {
    case "draft":
      return ActionCategory.Draft;
    case "member_action":
      return ActionCategory.Active;
    case "completed":
      return ActionCategory.Completed;
    case "planned":
    case "office_action":
    case "resolution":
    case "failed":
    case "abandoned":
      return ActionCategory.Pending;
    default:
      throw new Error(
        `unknown action status: ${action.status satisfies never}`,
      );
  }
};
