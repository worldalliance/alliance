export function isLedBy(
  community: { leaders: { id: number }[] },
  userId: number | undefined,
): boolean {
  return community.leaders.some((leader) => leader.id === userId);
}

/** Warns that joining another group leaves the ones the user doesn't lead;
 * null when there are none. */
export function groupRemovalMessage(
  memberGroups: { name: string }[],
  targetName?: string,
): string | null {
  if (!memberGroups.length) {
    return null;
  }
  const names = memberGroups.map((group) => group.name);
  const base =
    names.length === 1
      ? `your current group (${names[0]})`
      : `the following groups: (${names.join(", ")})`;
  if (!targetName) {
    return `You will be removed from ${base}.`;
  }
  return `Joining ${targetName} will remove you from ${base}.`;
}

export function getMemberCount(community: {
  users: unknown[];
  leaders: unknown[];
}) {
  return community.users.length - community.leaders.length;
}

/** Labels for someone undergoing group assignment. Without their groups,
 * whether it's an assignment or a reassignment is unknown, so neither is named. */
export function groupAssignmentLabels({
  isMember,
  didGroupsFail,
}: {
  isMember: boolean;
  didGroupsFail: boolean;
}) {
  if (didGroupsFail) {
    return { headingSuffix: "", cancelLabel: "Cancel group assignment" };
  }
  return isMember
    ? { headingSuffix: " (reassigning...)", cancelLabel: "Cancel reassignment" }
    : { headingSuffix: " (assigning...)", cancelLabel: "Cancel assignment" };
}
