import type { Action } from "./entities/action.entity";

export type ProjectStep = { action: Action; memberActionAt: Date | null };

export const toProjectStep = (action: Action): ProjectStep => ({
  action,
  memberActionAt: action.memberActionPhase.event?.date ?? null,
});

export const byProjectStepOrder = (a: ProjectStep, b: ProjectStep) =>
  (a.memberActionAt?.getTime() ?? Infinity) -
    (b.memberActionAt?.getTime() ?? Infinity) || a.action.id - b.action.id;

export const previousProjectStep = (actions: Action[]): Action | null =>
  actions
    .filter((action) => !action.archived && !action.onboarding)
    .map(toProjectStep)
    .sort(byProjectStepOrder)
    .at(-1)?.action ?? null;
