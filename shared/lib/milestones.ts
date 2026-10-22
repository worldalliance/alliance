export enum MilestoneKind {
  Example = "example",
  /** The one real commitment on the track, which the graphic makes stand out. */
  Plan = "plan",
  Completed = "completed",
}

export type Milestone = {
  members: number;
  label: string;
  kind?: MilestoneKind;
};

export function milestoneKind(milestone: Milestone): MilestoneKind {
  return milestone.kind ?? MilestoneKind.Example;
}

/**
 * How many whole-plus-fraction segments the current membership fills. A bar's
 * own fill is `filledSegments(...) - itsIndex`, clamped to 0..1, so each bar
 * measures the run from the milestone before it rather than from zero.
 */
export function filledSegments(
  milestones: Milestone[],
  members: number,
): number {
  let filled = 0;
  for (let i = 0; i < milestones.length; i++) {
    const from = i === 0 ? 0 : milestones[i - 1].members;
    const to = milestones[i].members;
    if (members >= to) {
      filled = i + 1;
      continue;
    }
    if (members > from) filled = i + (members - from) / (to - from);
    break;
  }
  return filled;
}
