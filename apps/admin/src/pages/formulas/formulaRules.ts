import { href } from "react-router";

export const NEW = "new";

export const FORMULAS_HREF = href("/tasks/formulas");

export const formulaPath = (formulaId: string) =>
  href("/tasks/formulas/:formulaId", { formulaId });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Formula ids are UUIDs, so any other id can't name one. */
export const canExist = (formulaId: string) =>
  formulaId === NEW || UUID.test(formulaId);

/** What deleting a formula does, as the save endpoint does it. */
export function deleteMessage(readers: number): string {
  const kept = "Its saved versions are kept.";
  return readers > 0
    ? `${readers === 1 ? "A formula reads" : `${readers} formulas read`} it, so the delete is refused unless the same save fixes what reads it. ${kept}`
    : `It leaves the list and its name is free to reuse. ${kept} If a draft suite's partition reads it, the delete is refused until you fix that part in the same save.`;
}
