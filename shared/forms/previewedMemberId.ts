/** The member a preview runs as, null for the sample user ("preview") or none. */
export const previewedMemberId = (
  previewUserId?: string | number | null,
): number | null =>
  previewUserId != null && /^\d+$/.test(String(previewUserId))
    ? Number(previewUserId)
    : null;
