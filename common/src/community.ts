import { R, type Result } from "./result";

export const COMMUNITY_NAME_MAX_LENGTH = 120;
export const COMMUNITY_DESCRIPTION_MAX_LENGTH = 4000;

type CommunityAccess = {
  public: boolean;
  allowMemberInvites: boolean;
  allowStaffAssignments: boolean;
};

type CommunitySeats = {
  maxCapacity: number | null;
  users?: readonly unknown[];
  leaders?: readonly unknown[];
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

/**
 * Non-leader member count (users minus leaders). Safe when relations are unloaded.
 */
export function getMemberCount(c: CommunitySeats): number {
  return (c.users?.length ?? 0) - (c.leaders?.length ?? 0);
}

/**
 * Free seats under the cap. Meaningless when `maxCapacity` is null.
 *
 * Placement splits in two, and only one half is capacity-bound:
 *
 * - Consensual — a leader named this group (invite link, one-time invite other
 *   than a waitlist invite, community invite). `maxCapacity` does not apply:
 *   the leader asked for this person, so call neither predicate below and just
 *   place them.
 * - Non-consensual — the automated referral system or staff picked the group on
 *   the leader's behalf. `maxCapacity` is the ceiling on those, gated by the
 *   matching opt-in flag.
 *
 * `maxCapacity` is null exactly when a group takes nothing non-consensual, so
 * the flag-gated predicates below already return false for it via their flag
 * check (see {@link checkCommunityAccessRules}).
 *
 * A waitlist invite's group, which staff picked through its organization, fits
 * neither: no opt-in flag covers it, so like a returning member it is gated on
 * {@link isAtCapacity} alone, and an uncapped group always takes the claimant.
 */
export function freeSlots(c: CommunitySeats): number {
  return (c.maxCapacity ?? 0) - getMemberCount(c);
}

/** At or past its cap. A consensual placement still joins it. */
export function isAtCapacity(c: CommunitySeats): boolean {
  return c.maxCapacity !== null && freeSlots(c) <= 0;
}

/** Room for one more member placed by the automated referral system. */
export function acceptsAutomatedMember(
  c: CommunitySeats & CommunityAccess,
): boolean {
  return c.allowMemberInvites && freeSlots(c) > 0;
}

/** Room for one more member assigned by Alliance staff. */
export function acceptsStaffAssignment(
  c: CommunitySeats & CommunityAccess,
): boolean {
  return c.allowStaffAssignments && freeSlots(c) > 0;
}

/** Room for one more member who found the group themselves and joined it. */
export function acceptsPublicJoin(
  c: CommunitySeats & CommunityAccess,
): boolean {
  return c.public && freeSlots(c) > 0;
}

/**
 * Room to re-admit a member who left only because their contract lapsed.
 *
 * Neither of the two buckets fits: the leader already accepted this person, but
 * the seat may have been refilled during the suspension. Deliberately gated on
 * capacity alone — a leader's cap reads as "this many people, whoever they
 * are", so a full group turns them away, while an uncapped group has no number
 * to exceed and always takes them back. The opt-in flags do not apply; nobody
 * is inviting or assigning anyone here.
 */
export function hasRoomForReturningMember(c: CommunitySeats): boolean {
  return !isAtCapacity(c);
}
