import { CellAssignment } from "@alliance/common/suite-split";
import { cellOf, type SplitGroup } from "src/suite-splits/split-groups";
import type { User } from "src/user/entities/user.entity";

/**
 * Who an action's cohort decision covers and how. A split suite's action
 * decides only members its split placed, from their group's grid cell; any
 * other action decides everyone it is given, by its cohort rule.
 */
export type DecidingCohort = {
  decides: (user: User) => boolean;
  included: (user: User) => boolean;
  /** The decision row's own optional field; null leaves it to the action's flag. */
  optional: (user: User) => boolean | null;
  required: (user: User) => boolean;
};

export function ruleCohort(params: {
  memberIds: ReadonlySet<number>;
  optional: boolean;
}): DecidingCohort {
  const { memberIds, optional } = params;
  return {
    decides: () => true,
    included: (user) => memberIds.has(user.id),
    optional: () => null,
    required: () => !optional,
  };
}

export function splitCohort(params: {
  actionId: number;
  groups: ReadonlyMap<number, SplitGroup>;
}): DecidingCohort {
  const { actionId, groups } = params;
  const cell = (user: User) => {
    const group = groups.get(user.id);
    if (group === undefined) throw new Error(`user ${user.id} isn't placed`);
    return cellOf(group, actionId);
  };
  return {
    decides: (user) => groups.has(user.id),
    included: (user) => cell(user) !== CellAssignment.NotAssigned,
    optional: (user) => cell(user) === CellAssignment.Optional,
    required: (user) => cell(user) === CellAssignment.Required,
  };
}
