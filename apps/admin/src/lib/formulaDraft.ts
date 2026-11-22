import type { FormulaDto, FormulaEditDto } from "@alliance/shared/client";

export const asDraft = (formula: FormulaDto): FormulaEditDto => ({
  id: formula.id,
  baseVersionId: formula.versionId,
  name: formula.name,
  text: formula.text,
  notes: formula.notes,
});
