import type { FollowUpFormDto } from "@alliance/shared/client";

export function followUpFormLabel(fuf: FollowUpFormDto): string {
  const label = fuf.name?.trim();
  return label ? label : `Follow-up form #${fuf.id}`;
}
