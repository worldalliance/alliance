import type { FormSchema, FormValue } from "./form-schema";
import {
  type ConditionExtras,
  evaluateVisibleIfFormula,
  hasEvaluableFormula,
  stripHiddenAnswers,
} from "./visibility";

/**
 * Whether the form's `skipIfFormula` holds for these answers, judged on the
 * answers the member can see. While it holds, submitting records a "Doesn't
 * apply to me" withdrawal and required fields don't block it.
 */
export function isFormSkipped(params: {
  schema: FormSchema;
  answers: Record<string, FormValue>;
  extras: ConditionExtras;
}): boolean {
  const { schema, answers, extras } = params;
  const formula = schema.skipIfFormula;
  if (!hasEvaluableFormula(formula)) return false;
  const visible = stripHiddenAnswers(schema.pages, answers, extras);
  return evaluateVisibleIfFormula(formula, visible, extras);
}
