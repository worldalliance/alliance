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
