import { freeSlots } from "@alliance/common/community";
import type { CommunityDto, UserDto } from "@alliance/shared/client/types.gen";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { byGroupName, takesStaffAssignments } from "./groupRules";

const STORAGE_KEY = "admin.groupAssignmentSelections";

/** Member id to group id, both as the strings the select and the storage hold. */
const storedSelections = z.record(z.string(), z.string());
type Selections = z.infer<typeof storedSelections>;

function readSelections(): Selections {
  try {
    const parsed = storedSelections.safeParse(
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"),
    );
    return parsed.success ? parsed.data : {};
  } catch (error) {
    console.warn("Failed to read group assignment selections", error);
    return {};
  }
}

export type GroupAssignment = { member: UserDto; group: CommunityDto };

/**
 * The group picked for each member awaiting one, kept in this browser until
 * confirmed, with the capacity rules that decide what may be picked and
 * confirmed. `members` is undefined until the queue loads, so a reload doesn't
 * prune the selections against an empty queue.
 */
export function useGroupAssignment({
  members,
  groups,
}: {
  members: readonly UserDto[] | undefined;
  groups: readonly CommunityDto[] | undefined;
}) {
  const [stored, setStored] = useState(readSelections);

  const selections = useMemo(() => {
    if (!members) return stored;
    const waiting = new Set(members.map((member) => String(member.id)));
    return Object.fromEntries(
      Object.entries(stored).filter(
        ([memberId, groupId]) => waiting.has(memberId) && groupId !== "",
      ),
    );
  }, [members, stored]);

  useEffect(() => {
    if (!members) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selections));
    } catch (error) {
      console.warn("Failed to save group assignment selections", error);
    }
  }, [members, selections]);

  const assignments = useMemo(() => {
    const groupById = new Map(
      groups?.map((group) => [String(group.id), group]),
    );
    return (members ?? []).flatMap((member): GroupAssignment[] => {
      const group = groupById.get(selections[member.id] ?? "");
      return group ? [{ member, group }] : [];
    });
  }, [groups, members, selections]);

  const pendingByGroupId = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const { group } of assignments) {
      counts[group.id] = (counts[group.id] ?? 0) + 1;
    }
    return counts;
  }, [assignments]);

  const groupOf = useCallback(
    (memberId: number) =>
      assignments.find(({ member }) => member.id === memberId)?.group ?? null,
    [assignments],
  );

  /** The groups a member's select offers: those with a seat left, and the one already picked. */
  const optionsFor = useCallback(
    (memberId: number) => {
      const picked = groupOf(memberId);
      return [...(groups ?? [])]
        .filter(
          (group) =>
            group.id === picked?.id ||
            (takesStaffAssignments(group) &&
              freeSlots(group) > (pendingByGroupId[group.id] ?? 0)),
        )
        .sort(byGroupName);
    },
    [groupOf, groups, pendingByGroupId],
  );

  /** Why a member's pick can't be confirmed, or null. */
  const problemOf = useCallback(
    (memberId: number) => {
      const group = groupOf(memberId);
      if (!group) return null;
      if (!takesStaffAssignments(group)) {
        return "This group is not available for assignment.";
      }
      const over = (pendingByGroupId[group.id] ?? 0) - freeSlots(group);
      return over > 0 ? `Over capacity by ${over}.` : null;
    },
    [groupOf, pendingByGroupId],
  );

  /** Why the assignments can't be confirmed yet, or null. */
  const blocker = !groups
    ? "The groups haven't loaded yet."
    : assignments.length === 0
      ? "Select at least one group assignment before confirming."
      : assignments.some(({ member }) => problemOf(member.id) !== null)
        ? "Fix the selections marked below before confirming."
        : null;

  const choose = useCallback(
    (memberId: number, groupId: string) =>
      setStored((prev) => ({ ...prev, [memberId]: groupId })),
    [],
  );

  const forget = useCallback(
    (memberIds: readonly number[]) =>
      setStored((prev) =>
        Object.fromEntries(
          Object.entries(prev).filter(
            ([memberId]) => !memberIds.includes(Number(memberId)),
          ),
        ),
      ),
    [],
  );

  return {
    assignments,
    pendingByGroupId,
    groupOf,
    optionsFor,
    problemOf,
    blocker,
    choose,
    forget,
  };
}

export type GroupAssignmentState = ReturnType<typeof useGroupAssignment>;
