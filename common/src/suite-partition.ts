/** Why a suite that uses parts can't be scheduled yet; the server refuses it with this. */
export const PARTITION_LAUNCH_REFUSED =
  "Partitioned suites can't launch yet: launch checks and moving members between parts come first.";

export enum CellAssignment {
  Required = "required",
  Optional = "optional",
  NotAssigned = "not_assigned",
}

/** The kind of work a part's grid row gives its members. */
export enum PartWork {
  Required = "required",
  OptionalOnly = "optional_only",
  Nothing = "nothing",
}

export function workOfCells(
  cells: readonly {
    assignment: `${CellAssignment.Required | CellAssignment.Optional}`;
  }[],
): PartWork {
  if (cells.some((cell) => cell.assignment === CellAssignment.Required)) {
    return PartWork.Required;
  }
  return cells.length > 0 ? PartWork.OptionalOnly : PartWork.Nothing;
}
