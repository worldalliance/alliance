import { R, type Result } from "./result";

export const COMMUNITY_NAME_MAX_LENGTH = 120;
export const COMMUNITY_DESCRIPTION_MAX_LENGTH = 4000;

type CommunityAccess = {
  public: boolean;
  allowMemberInvites: boolean;
  allowStaffAssignments: boolean;
};

/** Capacity is required once anyone besides a leader can add members. */
export function isMaxCapacityRequired(community: CommunityAccess): boolean {
  return (
    community.public ||
    community.allowMemberInvites ||
    community.allowStaffAssignments
  );
}

/** The check constraints on the community table, as a user-facing message. */
export function checkCommunityAccessRules(
  community: CommunityAccess & { maxCapacity: number | null },
): Result<void, string> {
  if (community.maxCapacity === null && isMaxCapacityRequired(community)) {
    return R.failure(
      "Capacity is required when the group is public or allows member invites or staff assignments",
    );
  }
  if (
    community.public &&
    !(community.allowMemberInvites && community.allowStaffAssignments)
  ) {
    return R.failure(
      "A public group must allow member invites and staff assignments",
    );
  }
  return R.success(undefined);
}
