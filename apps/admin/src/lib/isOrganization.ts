import type {
  CampaignDto,
  CampaignKind,
} from "@alliance/shared/client/types.gen";

const IS_ORGANIZATION: Record<CampaignKind, boolean> = {
  campaign: false,
  organization: true,
};

export const isOrganization = (campaign: CampaignDto): boolean =>
  IS_ORGANIZATION[campaign.kind];
