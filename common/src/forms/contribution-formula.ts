import type { z } from "zod";
import type { VariableInput } from "./variable-inputs";
import { optionsFormulaSchema } from "./variables";

const READS_OWN_ANSWERS: Record<VariableInput["kind"], boolean> = {
  field: true,
  list: true,
  sourceField: false,
  sourceList: false,
  aggregate: false,
};

/** A formula over one member's answers to an action's form. */
export const contributionFormulaSchema = optionsFormulaSchema.refine(
  (formula) =>
    Object.values(formula.inputs).every(
      (input) => READS_OWN_ANSWERS[input.kind],
    ),
  "A contribution formula can only read the member's answers to this action's form",
);
export type ContributionFormula = z.infer<typeof contributionFormulaSchema>;

// A union rather than an enum: the server's enum values and the generated
// client's string literals both index it without a cast.
export type ContributionFormulaMode = "normal" | "retrospective";

/** Which action-update column holds each mode's contribution formula. */
export const CONTRIBUTION_FORMULA_KEY: Record<
  ContributionFormulaMode,
  "contributionFormula" | "retrospectiveContributionFormula"
> = {
  normal: "contributionFormula",
  retrospective: "retrospectiveContributionFormula",
};
