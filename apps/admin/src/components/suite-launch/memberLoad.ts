export const MAX_MEMBER_MINUTES = 15;

export type MemberLoad = {
  userId: number;
  actionIds: number[];
  minutes: number;
};

/** Each member any action's cohort includes, with their actions' summed time estimates, heaviest first. */
export function memberLoads(params: {
  actions: { id: number; timeEstimate: number | null }[];
  cohortByActionId: ReadonlyMap<number, readonly number[]>;
}): MemberLoad[] {
  const { actions, cohortByActionId } = params;
  const loads = new Map<number, MemberLoad>();
  for (const action of actions) {
    for (const userId of cohortByActionId.get(action.id) ?? []) {
      const load = loads.get(userId) ?? { userId, actionIds: [], minutes: 0 };
      load.actionIds.push(action.id);
      load.minutes += action.timeEstimate ?? 0;
      loads.set(userId, load);
    }
  }
  return [...loads.values()].sort(
    (a, b) => b.minutes - a.minutes || a.userId - b.userId,
  );
}
