import { deburr } from "es-toolkit";

export const fold = (text: string) => deburr(text).toLowerCase();

export function matchesOptionSearch(
  option: { label: string },
  query: string,
): boolean {
  return fold(option.label).includes(fold(query.trim()));
}
