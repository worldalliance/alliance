import type { EventType } from "../client/types.gen";

const onetimeInvitesAdminAll = () => ["userGetOnetimeInvitesAdmin"] as const;

/**
 * Central registry of react-query keys
 */
export const queryKeys = {
  allianceMemberCount: () => ["userNmembers"] as const,
  myAwayRanges: () => ["userGetAwayRanges"] as const,
  onetimeInvitesOverview: () => ["userGetOnetimeInvitesOverview"] as const,
  ambassadorInviteDashboard: () =>
    ["userGetAmbassadorInviteDashboard"] as const,
  myReusableInvites: () => ["shareUrlsMyInvites"] as const,
  communityOnetimeInvites: (communityId: number) =>
    ["userGetOnetimeInvitesByCommunity", communityId] as const,
  publicCommunities: () => ["communityGetPublicCommunities"] as const,
  linkPreview: (url: string) => ["linkPreviewGetPreview", url] as const,

  // Admin
  tagsAdmin: () => ["userGetTagsAdmin"] as const,
  onetimeInvitesAdminAll,
  onetimeInvitesAdmin: (page: number, limit: number) =>
    [...onetimeInvitesAdminAll(), page, limit] as const,
  onetimeInviteMemberStatsAdmin: () =>
    ["userGetOnetimeInviteMemberStatsAdmin"] as const,
  eventLogAdmin: (page: number, limit: number, eventType: EventType | "") =>
    ["eventLogFindAllAdmin", page, limit, eventType] as const,
  ambassadorProgramAdmin: () => ["userGetAmbassadorProgramAdmin"] as const,
  reminderGroupClickRatesAdmin: () =>
    ["analyticsGetReminderGroupClickRatesAdmin"] as const,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as const satisfies Record<string, (...args: any[]) => readonly unknown[]>;
