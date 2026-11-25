import {
  CellAssignment,
  PartWork,
  workOfCells,
} from "@alliance/common/suite-partition";
import type {
  PartitionCellDto,
  PartitionPartDraftDto,
  SuitePartitionDto,
} from "@alliance/shared/client";
import { sortBy } from "es-toolkit";

/** Cells sorted by action, so assigning a cell back leaves its part as it was. */
export const draftsOf = (
  partition: SuitePartitionDto,
): PartitionPartDraftDto[] =>
  partition.parts.map((part) => ({
    id: part.id,
    name: part.name,
    text: part.text,
    fallback: part.fallback,
    noRequiredWorkTick: part.noRequiredWorkTick !== null,
    cells: sortBy(part.cells, ["actionId"]),
  }));

export const cellOf = (
  part: Pick<PartitionPartDraftDto, "cells">,
  actionId: number,
): `${CellAssignment}` =>
  part.cells.find((cell) => cell.actionId === actionId)?.assignment ??
  CellAssignment.NotAssigned;

export function withCell(
  part: PartitionPartDraftDto,
  actionId: number,
  choice: CellAssignment,
): PartitionPartDraftDto {
  const has = part.cells.some((cell) => cell.actionId === actionId);
  const cells: PartitionCellDto[] =
    choice === CellAssignment.NotAssigned
      ? part.cells.filter((cell) => cell.actionId !== actionId)
      : has
        ? part.cells.map((cell) =>
            cell.actionId === actionId
              ? { actionId, assignment: choice }
              : cell,
          )
        : sortBy(
            [...part.cells, { actionId, assignment: choice }],
            ["actionId"],
          );
  const kept = workOfCells(cells) === workOfCells(part.cells);
  return {
    ...part,
    cells,
    noRequiredWorkTick: kept && part.noRequiredWorkTick,
  };
}

export const hasRequiredWork = (part: Pick<PartitionPartDraftDto, "cells">) =>
  workOfCells(part.cells) === PartWork.Required;

export const newPart = (): PartitionPartDraftDto => ({
  id: crypto.randomUUID(),
  name: "",
  text: "",
  fallback: null,
  noRequiredWorkTick: false,
  cells: [],
});

/** Moves the part at `index` by `by`, keeping "Everyone else" last. */
export function moved<T>(parts: T[], index: number, by: -1 | 1): T[] {
  const target = index + by;
  if (target < 0 || target >= parts.length - 1) return parts;
  const next = [...parts];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Shown under a part's condition wherever an admin edits one. */
export const CONDITION_HINT =
  'A yes/no formula, such as isOnList("Volunteers").';
