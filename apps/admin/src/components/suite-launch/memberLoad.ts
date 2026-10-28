export const MAX_MEMBER_MINUTES = 15;

export type MemberLoad = {
  userId: number;
  actionIds: number[];
  minutes: number;
  otherActionIds: number[];
  otherMinutes: number;
};

type TimedAction = { id: number; timeEstimate: number | null };

export const totalMinutes = (load: MemberLoad) =>
  load.minutes + load.otherMinutes;

/** Each member any suite action's cohort includes, with the suite actions' and
 * other live actions' summed time estimates, heaviest first. */
export function memberLoads(params: {
  actions: TimedAction[];
  otherActions?: TimedAction[];
  cohortByActionId: ReadonlyMap<number, readonly number[]>;
}): MemberLoad[] {
  const { actions, otherActions = [], cohortByActionId } = params;
  const loads = new Map<number, MemberLoad>();
  for (const action of actions) {
    for (const userId of cohortByActionId.get(action.id) ?? []) {
      const load = loads.get(userId) ?? {
        userId,
        actionIds: [],
        minutes: 0,
        otherActionIds: [],
        otherMinutes: 0,
      };
      load.actionIds.push(action.id);
      load.minutes += action.timeEstimate ?? 0;
      loads.set(userId, load);
    }
  }
  for (const action of otherActions) {
    for (const userId of cohortByActionId.get(action.id) ?? []) {
      const load = loads.get(userId);
      if (!load) continue;
      load.otherActionIds.push(action.id);
      load.otherMinutes += action.timeEstimate ?? 0;
    }
  }
  return [...loads.values()].sort(
    (a, b) => totalMinutes(b) - totalMinutes(a) || a.userId - b.userId,
  );
}

export type ActionMix = {
  actionIds: number[];
  minutes: number;
  userIds: number[];
};

/** Members grouped by the exact set of suite actions they get, most common first. */
export function actionMixes(loads: MemberLoad[]): ActionMix[] {
  const mixes = new Map<string, ActionMix>();
  for (const load of loads) {
    const key = load.actionIds.join(",");
    const mix = mixes.get(key) ?? {
      actionIds: load.actionIds,
      minutes: load.minutes,
      userIds: [],
    };
    mix.userIds.push(load.userId);
    mixes.set(key, mix);
  }
  return [...mixes.values()].sort(
    (a, b) => b.userIds.length - a.userIds.length || b.minutes - a.minutes,
  );
}
