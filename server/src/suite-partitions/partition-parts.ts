import { exprSchema } from "@alliance/common/expression/tree-schema";
import {
  CellAssignment,
  PartWork,
  workOfCells,
} from "@alliance/common/suite-partition";
import { z } from "zod";

/** What a part does with a member whose condition is undecided. */
export enum PartFallback {
  PutHere = "put_here",
  Continue = "continue",
}

export const EVERYONE_ELSE = "Everyone else";

const cellSchema = z.object({
  actionId: z.number().int(),
  assignment: z.enum([CellAssignment.Required, CellAssignment.Optional]),
});

/**
 * A part as stored in a partition version. `condition` is null only for the last
 * part, "Everyone else". `cells` lists the assigned actions; an action
 * missing from it is not assigned. `noRequiredWorkTick` holds the kind of work
 * the part had when ticked, so the tick lapses when that kind changes.
 */
export const partitionPartSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  condition: exprSchema.nullable(),
  fallback: z.enum(PartFallback).nullable(),
  noRequiredWorkTick: z
    .enum([PartWork.OptionalOnly, PartWork.Nothing])
    .nullable(),
  cells: z.array(cellSchema),
});

export const partitionPartsSchema = z.array(partitionPartSchema);

export type PartitionPart = z.infer<typeof partitionPartSchema>;

export function cellOf(
  part: Pick<PartitionPart, "cells">,
  actionId: number,
): CellAssignment {
  return (
    part.cells.find((cell) => cell.actionId === actionId)?.assignment ??
    CellAssignment.NotAssigned
  );
}

export function workOf(
  part: Pick<PartitionPart, "cells">,
  actionIds: readonly number[],
): PartWork {
  return workOfCells(
    part.cells.filter((cell) => actionIds.includes(cell.actionId)),
  );
}

/**
 * The action-wide optional flag a partition implies: optional when every part
 * assigning the action assigns it as optional.
 */
export function impliedOptional(
  parts: readonly Pick<PartitionPart, "cells">[],
  actionId: number,
): boolean {
  const cells = parts
    .map((part) => cellOf(part, actionId))
    .filter((cell) => cell !== CellAssignment.NotAssigned);
  return (
    cells.length > 0 && cells.every((cell) => cell === CellAssignment.Optional)
  );
}
