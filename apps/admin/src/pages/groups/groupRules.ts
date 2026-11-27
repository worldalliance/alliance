import { freeSlots } from "@alliance/common/community";
import type {
  CommunityDto,
  ProfileDto,
} from "@alliance/shared/client/types.gen";
export const byPersonName = (a: ProfileDto, b: ProfileDto) =>
  (a.displayName ?? "").localeCompare(b.displayName ?? "", undefined, {
    sensitivity: "base",
  });

export const byGroupName = (a: CommunityDto, b: CommunityDto) =>
  a.name
    .trim()
    .localeCompare(b.name.trim(), undefined, { sensitivity: "base" });

/** Staff can place a waiting member only in a group that takes staff assignments under a cap. */
export const takesStaffAssignments = (group: CommunityDto) =>
  group.allowStaffAssignments && group.maxCapacity !== null;

/** Seats the group has free now; null without a cap. */
export const openSeats = (group: CommunityDto) =>
  group.maxCapacity === null ? null : Math.max(0, freeSlots(group));

/**
 * Free seats over the capped groups, less the members still awaiting a group,
 * never below zero.
 */
export const unusedCapacity = (
  groups: readonly CommunityDto[],
  awaitingCount: number,
) =>
  Math.max(
    0,
    groups.reduce(
      (sum, group) =>
        group.maxCapacity === null ? sum : sum + Math.max(0, freeSlots(group)),
      0,
    ) - awaitingCount,
  );
