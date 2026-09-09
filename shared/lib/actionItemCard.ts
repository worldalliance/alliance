import { ActionActivityDto, ActionDto } from "../client";

export function showCompletedBar(
  action: Pick<ActionDto, "status" | "onboarding">,
) {
  return action.status === "member_action" && !action.onboarding;
}

export interface ActionItemCardPropsShared {
  action: Pick<
    ActionDto,
    | "name"
    | "shortDescription"
    | "category"
    | "id"
    | "status"
    | "onboarding"
    | "usersJoined"
    | "userRelation"
    | "usersCompleted"
    | "squareThumbnailImage"
    | "squareThumbnailImageAlt"
    | "optional"
    | "viewer"
  >;
  friendCommitmentActivities?: ActionActivityDto[];
}
