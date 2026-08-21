import { Community } from "./entities/community.entity";

/**
 * Non-leader member count (users minus leaders). Safe when relations are unloaded.
 */
export function getMemberCount(c: Community): number {
  return (c.users?.length ?? 0) - (c.leaders?.length ?? 0);
}

/**
 * Placement splits in two, and only one half is capacity-bound:
 *
 * - Consensual — a leader named this group (invite link, one-time invite,
 *   community invite). `maxCapacity` does not apply: the leader asked for this
 *   person, so call neither predicate below and just place them.
 * - Non-consensual — the automated referral system or staff picked the group on
 *   the leader's behalf. `maxCapacity` is the ceiling on those, gated by the
 *   matching opt-in flag.
 *
 * `maxCapacity` is null exactly when a group takes nothing non-consensual, so
 * the flag-gated predicates below already return false for it via their flag
 * check (see the check constraint on {@link Community}).
 */
function freeSlots(c: Community): number {
  return (c.maxCapacity ?? 0) - getMemberCount(c);
}

/** Room for one more member placed by the automated referral system. */
export function acceptsAutomatedMember(c: Community): boolean {
  return c.allowMemberInvites && freeSlots(c) > 0;
}

/** Room for one more member assigned by Alliance staff. */
export function acceptsStaffAssignment(c: Community): boolean {
  return c.allowStaffAssignments && freeSlots(c) > 0;
}

/** Room for one more member who found the group themselves and joined it. */
export function acceptsPublicJoin(c: Community): boolean {
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
export function hasRoomForReturningMember(c: Community): boolean {
  return c.maxCapacity === null || freeSlots(c) > 0;
}

/**
 * Free seats for staff assignment, for reporting how many more will fit.
 * Meaningless unless {@link acceptsStaffAssignment} is true.
 */
export function getStaffAssignableSlots(c: Community): number {
  return freeSlots(c);
}

/**
 * True when the given user is a leader of the community. Safe when leaders relation is unloaded.
 */
export function isCommunityLedBy(c: Community, userId: number): boolean {
  return c.leaders?.some((leader) => leader.id === userId) ?? false;
}
