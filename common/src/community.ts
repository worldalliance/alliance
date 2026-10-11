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

/**
 * The checks a group form runs before saving. Returns the trimmed name and the
 * capacity to send, which is null when nothing requires one.
 */
export function validateCommunitySettings(params: {
  settings: CommunityAccess & {
    name: string;
    maxCapacity: number | null | undefined;
  };
  /** The capacity may not drop below this; null allows any capacity. */
  memberCount: number | null;
}): Result<{ name: string; maxCapacity: number | null }, string> {
  const { settings, memberCount } = params;
  const name = settings.name.trim();
  if (!name) {
    return R.failure("Name is required");
  }
  const maxCapacity =
    isMaxCapacityRequired(settings) &&
    settings.maxCapacity != null &&
    settings.maxCapacity > 0
      ? settings.maxCapacity
      : null;
  return R.flatMap(
    checkCommunityAccessRules({ ...settings, maxCapacity }),
    () =>
      maxCapacity !== null && memberCount !== null && maxCapacity < memberCount
        ? R.failure(
            `Capacity cannot be less than the current number of members (${memberCount})`,
          )
        : R.success({ name, maxCapacity }),
  );
}
