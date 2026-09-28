export const COMMUNITY_NAME_MAX_LENGTH = 120;
export const COMMUNITY_DESCRIPTION_MAX_LENGTH = 4000;

/** Capacity is required once anyone besides a leader can add members. */
export function isMaxCapacityRequired(community: {
  public: boolean;
  allowMemberInvites: boolean;
  allowStaffAssignments: boolean;
}): boolean {
  return (
    community.public ||
    community.allowMemberInvites ||
    community.allowStaffAssignments
  );
}
