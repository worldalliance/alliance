import { freeSlots } from "@alliance/common/community";
import type {
  CommunityDto,
  ProfileDto,
} from "@alliance/shared/client/types.gen";
import { href } from "react-router";

export const groupHref = (group: { id: number }) =>
  href("/members/groups/:id", { id: group.id.toString() });

export const memberHref = (userId: number) =>
  href("/members/:userId", { userId: userId.toString() });

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

/** Seats left once the selections waiting on the Awaiting assignment tab are counted; null without a cap. */
export const openSeats = (group: CommunityDto, pending: number) =>
  group.maxCapacity === null ? null : Math.max(0, freeSlots(group) - pending);

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
