import { softDeleteCascade } from "src/datasources/soft-delete";
import type { EntityManager } from "typeorm";
import { ActionReviewer } from "./entities/action-reviewer.entity";

/**
 * The rows to save as the action's reviewers. A reviewer sent again keeps
 * its row, so a save that leaves the list alone soft-deletes nothing.
 */
export async function replaceReviewers(params: {
  em: EntityManager;
  actionId: number;
  rows: ActionReviewer[];
}): Promise<ActionReviewer[]> {
  const { em, actionId, rows } = params;
  const unmatched = await em.findBy(ActionReviewer, { actionId });
  for (const row of rows) {
    const index = unmatched.findIndex(
      (old) =>
        old.name === row.name && old.url === row.url && old.icon === row.icon,
    );
    if (index !== -1) {
      row.id = unmatched[index].id;
      unmatched.splice(index, 1);
    }
  }
  await softDeleteCascade(em, {
    target: ActionReviewer,
    ids: unmatched.map((old) => old.id),
  });
  return rows;
}
