export const SHARE_URL_LABEL_MAX_LENGTH = 120;

export function normalizeShareUrlLabel(
  label: string | undefined,
): string | null {
  return label?.trim() || null;
}
