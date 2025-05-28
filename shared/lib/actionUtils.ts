import { ActionDto } from "../client";

export enum FilterMode {
  All = "all",
  Active = "Active",
  Upcoming = "Upcoming",
  Past = "Past",
  Joined = "joined",
}

export const filterActions = (actions: ActionDto[], mode: FilterMode): ActionDto[] => {
  if (mode === FilterMode.All) {
    return actions;
  }

  if (mode === FilterMode.Joined) {
    return actions.filter((action) => action.myRelation?.status === "joined");
  }

  return actions.filter((action) => action.status === mode);
};