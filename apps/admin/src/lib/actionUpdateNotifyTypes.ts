import type { Assert, Equal } from "@alliance/common/types";
import type { ActionUpdateNotifyType } from "@alliance/shared/client";

export const ACTION_UPDATE_NOTIFY_TYPES = [
  "none",
  "action_cohort",
  "all_members",
  "tag",
] as const satisfies readonly ActionUpdateNotifyType[];

type _typecheck = Assert<
  Equal<(typeof ACTION_UPDATE_NOTIFY_TYPES)[number], ActionUpdateNotifyType>
>;

export const ACTION_UPDATE_NOTIFY_TYPE_LABELS: Record<
  ActionUpdateNotifyType,
  string
> = {
  none: "No notification",
  action_cohort: "Action cohort members",
  all_members: "All members",
  tag: "Specific tag",
};
