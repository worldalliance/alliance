import { exprSchema } from "@alliance/common/expression/tree-schema";
import {
  CellAssignment,
  GroupWork,
  workOfCells,
} from "@alliance/common/suite-split";
import { z } from "zod";

/** What a group does with a member whose condition is undecided. */
export enum GroupFallback {
  PutHere = "put_here",
  Continue = "continue",
}

export const EVERYONE_ELSE = "Everyone else";

const cellSchema = z.object({
  actionId: z.number().int(),
  assignment: z.enum([CellAssignment.Required, CellAssignment.Optional]),
});

/**
 * A group as stored in a split version. `condition` is null only for the last
 * group, "Everyone else". `cells` lists the assigned actions; an action
 * missing from it is not assigned. `noRequiredWorkTick` holds the kind of work
 * the group had when ticked, so the tick lapses when that kind changes.
 */
export const splitGroupSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  condition: exprSchema.nullable(),
  fallback: z.enum(GroupFallback).nullable(),
  noRequiredWorkTick: z
    .enum([GroupWork.OptionalOnly, GroupWork.Nothing])
    .nullable(),
  cells: z.array(cellSchema),
});

export const splitGroupsSchema = z.array(splitGroupSchema);

export type SplitGroup = z.infer<typeof splitGroupSchema>;

export function cellOf(
  group: Pick<SplitGroup, "cells">,
  actionId: number,
): CellAssignment {
  return (
    group.cells.find((cell) => cell.actionId === actionId)?.assignment ??
    CellAssignment.NotAssigned
  );
}

export function workOf(
  group: Pick<SplitGroup, "cells">,
  actionIds: readonly number[],
): GroupWork {
  return workOfCells(
    group.cells.filter((cell) => actionIds.includes(cell.actionId)),
  );
}

/**
 * The action-wide optional flag a split implies: optional when every group
 * assigning the action assigns it as optional.
 */
export function impliedOptional(
  groups: readonly Pick<SplitGroup, "cells">[],
  actionId: number,
): boolean {
  const cells = groups
    .map((group) => cellOf(group, actionId))
    .filter((cell) => cell !== CellAssignment.NotAssigned);
  return (
    cells.length > 0 && cells.every((cell) => cell === CellAssignment.Optional)
  );
}
