import type { FieldKind } from "@alliance/common/forms/form-schema";

export const AI_SCORE_FIELD_KINDS = new Set<FieldKind>(["text", "textarea"]);

export const formatAiScore = (value: number | null): string => {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return `${Math.round(value * 100)}%`;
};
