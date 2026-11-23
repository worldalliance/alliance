import {
  CellAssignment,
  GroupWork,
  workOfCells,
} from "@alliance/common/suite-split";
import type {
  SplitCellDto,
  SplitGroupDraftDto,
  SuiteSplitDto,
} from "@alliance/shared/client";
import { sortBy } from "es-toolkit";

/** Cells sorted by action, so assigning a cell back leaves its group as it was. */
export const draftsOf = (split: SuiteSplitDto): SplitGroupDraftDto[] =>
  split.groups.map((group) => ({
    id: group.id,
    name: group.name,
    text: group.text,
    fallback: group.fallback,
    noRequiredWorkTick: group.noRequiredWorkTick !== null,
    cells: sortBy(group.cells, ["actionId"]),
  }));

export const cellOf = (
  group: Pick<SplitGroupDraftDto, "cells">,
  actionId: number,
): `${CellAssignment}` =>
  group.cells.find((cell) => cell.actionId === actionId)?.assignment ??
  CellAssignment.NotAssigned;

export function withCell(
  group: SplitGroupDraftDto,
  actionId: number,
  choice: CellAssignment,
): SplitGroupDraftDto {
  const has = group.cells.some((cell) => cell.actionId === actionId);
  const cells: SplitCellDto[] =
    choice === CellAssignment.NotAssigned
      ? group.cells.filter((cell) => cell.actionId !== actionId)
      : has
        ? group.cells.map((cell) =>
            cell.actionId === actionId
              ? { actionId, assignment: choice }
              : cell,
          )
        : sortBy(
            [...group.cells, { actionId, assignment: choice }],
            ["actionId"],
          );
  const kept = workOfCells(cells) === workOfCells(group.cells);
  return {
    ...group,
    cells,
    noRequiredWorkTick: kept && group.noRequiredWorkTick,
  };
}

export const hasRequiredWork = (group: Pick<SplitGroupDraftDto, "cells">) =>
  workOfCells(group.cells) === GroupWork.Required;

export const newGroup = (): SplitGroupDraftDto => ({
  id: crypto.randomUUID(),
  name: "",
  text: "",
  fallback: null,
  noRequiredWorkTick: false,
  cells: [],
});

/** Moves the group at `index` by `by`, keeping "Everyone else" last. */
export function moved<T>(groups: T[], index: number, by: -1 | 1): T[] {
  const target = index + by;
  if (target < 0 || target >= groups.length - 1) return groups;
  const next = [...groups];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
