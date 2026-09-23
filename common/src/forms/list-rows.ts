import type { FormValue } from "./form-schema";

export function isListRow(value: unknown): value is Record<string, FormValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
