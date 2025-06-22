import { ActionDto } from "../client";

export enum FilterMode {
  All = "all",
  Active = "active",
  Upcoming = "upcoming",
  Past = "past",
  Joined = "joined",
}

export const ACTION_FILTERS = Object.values(FilterMode);

export const filterActions = (
  actions: ActionDto[],
  mode: FilterMode
): ActionDto[] => {
  if (mode === FilterMode.All) {
    return actions;
  }

  if (mode === FilterMode.Joined) {
    return actions.filter((action) => action.myRelation?.status === "joined");
  }

  return actions.filter((action) => action.status === mode);
};
