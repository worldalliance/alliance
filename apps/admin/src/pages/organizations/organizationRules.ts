import type { CampaignDto } from "@alliance/shared/client/types.gen";

/** The groups other organizations own, which this one can't also take. */
export const groupsTakenByOthers = (
  organizations: readonly CampaignDto[],
  organizationId: number,
): ReadonlySet<number> =>
  new Set(
    organizations.flatMap((other) =>
      other.id !== organizationId && other.communityId !== null
        ? [other.communityId]
        : [],
    ),
  );

export const matchesName = (organization: CampaignDto, q: string) =>
  organization.name.toLowerCase().includes(q.trim().toLowerCase());
