/** Why a suite that uses groups can't be scheduled yet; the server refuses it with this. */
export const SPLIT_LAUNCH_REFUSED =
  "Suites that use groups can't launch yet: launch checks and moving members between groups come first.";

export enum CellAssignment {
  Required = "required",
  Optional = "optional",
  NotAssigned = "not_assigned",
}

/** The kind of work a group's grid row gives its members. */
export enum GroupWork {
  Required = "required",
  OptionalOnly = "optional_only",
  Nothing = "nothing",
}

export function workOfCells(
  cells: readonly {
    assignment: `${CellAssignment.Required | CellAssignment.Optional}`;
  }[],
): GroupWork {
  if (cells.some((cell) => cell.assignment === CellAssignment.Required)) {
    return GroupWork.Required;
  }
  return cells.length > 0 ? GroupWork.OptionalOnly : GroupWork.Nothing;
}
