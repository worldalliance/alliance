import type { ActionFormAssignmentDto } from "@alliance/shared/client";

export enum FormArmKind {
  Variant = "variant",
  Branch = "branch",
}

/** A variant or branch: a form a member can be put on. */
export type FormArm = { id: number; name: string };

export const formArmIdOf: Record<
  FormArmKind,
  (row: ActionFormAssignmentDto) => number | null
> = {
  [FormArmKind.Variant]: (row) => row.variantId,
  [FormArmKind.Branch]: (row) => row.branchId,
};
