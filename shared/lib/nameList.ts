/**
 * Separator rendered after item `index` in an Oxford-comma name list —
 * "A and B", "A, B, and C". Empty after the last item.
 */
export function nameListSeparator(index: number, length: number): string {
  if (index >= length - 1) return "";
  if (index === length - 2) return length > 2 ? ", and " : " and ";
  return ", ";
}

/** Joins names Oxford-style: "A", "A and B", "A, B, and C". */
export function joinNames(names: string[]): string {
  return names
    .map((name, i) => name + nameListSeparator(i, names.length))
    .join("");
}
