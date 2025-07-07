import { ActionDto } from "../client";

export enum FilterMode {
  All = "All",
  GatheringCommitments = "Gathering Commitments",
  InProgress = "In Progress",
  Past = "Past",
}

export const ACTION_FILTERS = Object.values(FilterMode);

export const filterActions = (
  actions: ActionDto[],
  mode: FilterMode
): ActionDto[] => {
  switch (mode) {
    case FilterMode.All:
      return actions;
    case FilterMode.GatheringCommitments:
      return actions.filter(
        (action) => action.status === "gathering_commitments"
      );
    case FilterMode.InProgress:
      return actions.filter((action) => action.status === "member_action");
    case FilterMode.Past:
      return actions.filter(
        (action) => action.status === "completed" || action.status === "failed"
      );
    default:
      const x: never = mode;
      throw new Error(`Invalid filter mode: ${x}`);
  }
};
