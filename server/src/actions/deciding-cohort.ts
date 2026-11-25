import { CellAssignment } from "@alliance/common/suite-partition";
import {
  cellOf,
  type PartitionPart,
} from "src/suite-partitions/partition-parts";
import type { User } from "src/user/entities/user.entity";

/**
 * Who an action's cohort decision covers and how. A partitioned suite's action
 * decides only members its partition placed, from their part's grid cell; any
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

export function partitionCohort(params: {
  actionId: number;
  parts: ReadonlyMap<number, PartitionPart>;
}): DecidingCohort {
  const { actionId, parts } = params;
  const cell = (user: User) => {
    const part = parts.get(user.id);
    if (part === undefined) throw new Error(`user ${user.id} isn't placed`);
    return cellOf(part, actionId);
  };
  return {
    decides: (user) => parts.has(user.id),
    included: (user) => cell(user) !== CellAssignment.NotAssigned,
    optional: (user) => cell(user) === CellAssignment.Optional,
    required: (user) => cell(user) === CellAssignment.Required,
  };
}
