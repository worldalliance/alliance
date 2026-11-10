import {
  UserActionRelationPillStatus,
  type UserActionRelations,
} from "src/user/dto/user-action-relations.dto";

/**
 * Shows each combined split as one action under its title, the first of its
 * arms listed, and each member's relation to it as their relation to the arm
 * they have one with, so the matrix doesn't tell which arm a member got.
 */
export function collapseCombinedArms(params: {
  relations: UserActionRelations;
  splitOfArm: ReadonlyMap<number, { id: number; title: string }>;
}): UserActionRelations {
  const { relations, splitOfArm } = params;
  const leadBySplit = new Map<number, number>();
  for (const action of relations.actions) {
    const split = splitOfArm.get(action.id);
    if (split && !leadBySplit.has(split.id)) {
      leadBySplit.set(split.id, action.id);
    }
  }
  const leadOf = (actionId: number) => {
    const split = splitOfArm.get(actionId);
    return split ? leadBySplit.get(split.id) : actionId;
  };
  return {
    ...relations,
    actions: relations.actions.flatMap((action) => {
      const split = splitOfArm.get(action.id);
      if (!split) return [action];
      return leadOf(action.id) === action.id
        ? [{ ...action, name: split.title }]
        : [];
    }),
    users: relations.users.map((user) => {
      const byLead = new Map<number, (typeof user.relations)[number]>();
      for (const relation of user.relations) {
        const lead = leadOf(relation.actionId);
        if (lead === undefined) continue;
        const held = byLead.get(lead);
        if (
          !held ||
          (held.status === UserActionRelationPillStatus.NotRequired &&
            relation.status !== UserActionRelationPillStatus.NotRequired)
        ) {
          byLead.set(lead, { ...relation, actionId: lead });
        }
      }
      return { ...user, relations: [...byLead.values()] };
    }),
  };
}
