export function normalizeShareUrlLabel(
  label: string | undefined,
): string | null {
  return label?.trim() || null;
}
