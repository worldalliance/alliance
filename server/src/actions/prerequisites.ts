import { hasMemberActionDeadlinePassed } from "src/utils/action-user";

export type PrerequisiteProgress = {
  deadline: Date | null;
  /** Members who completed or withdrew. */
  terminalUserIds: ReadonlySet<number>;
  /** Members its saved cohort decisions exclude. */
  excludedUserIds: ReadonlySet<number>;
};

/**
 * Whether the member can be decided: for every prerequisite, they completed or
 * withdrew, its member-action deadline passed, or it excluded them. Dismissal,
 * optionality, and absence resolve nothing.
 */
export function arePrerequisitesReady(params: {
  prerequisites: PrerequisiteProgress[];
  userId: number;
  now: Date;
}): boolean {
  const { prerequisites, userId, now } = params;
  return prerequisites.every(
    (prerequisite) =>
      hasMemberActionDeadlinePassed(prerequisite.deadline, now) ||
      prerequisite.terminalUserIds.has(userId) ||
      prerequisite.excludedUserIds.has(userId),
  );
}
