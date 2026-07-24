import type { EventType } from "../client/types.gen";

const onetimeInvitesAdminAll = () => ["userGetOnetimeInvitesAdmin"] as const;

/**
 * Central registry of react-query keys
 */
export const queryKeys = {
  allianceMemberCount: () => ["userNmembers"] as const,
  ambassadorInviteDashboard: () =>
    ["userGetAmbassadorInviteDashboard"] as const,
  communityOnetimeInvites: (communityId: number) =>
    ["userGetOnetimeInvitesByCommunity", communityId] as const,
  linkPreview: (url: string) => ["linkPreviewGetPreview", url] as const,
  myAwayRanges: () => ["userGetAwayRanges"] as const,
  myReusableInvites: () => ["shareUrlsMyInvites"] as const,
  myVisibilityContext: () => ["userMyVisibilityContext"] as const,
  onetimeInvitesOverview: () => ["userGetOnetimeInvitesOverview"] as const,
  publicCommunities: () => ["communityGetPublicCommunities"] as const,

  // Admin
  actionAdmin: (actionId: number | null) =>
    ["actionsFindOneAdmin", actionId] as const,
  actionsAllAdmin: () => ["actionsFindAllWithDraftsAdmin"] as const,
  actionRelationsAdmin: () => ["actionsActionRelationsAdmin"] as const,
  ambassadorProgramAdmin: () => ["userGetAmbassadorProgramAdmin"] as const,
  eventLogAdmin: (page: number, limit: number, eventType: EventType | "") =>
    ["eventLogFindAllAdmin", page, limit, eventType] as const,
  memberContactInfoAdmin: () =>
    ["communityGetAllMemberContactInfoAdmin"] as const,
  onetimeInvitesAdminAll,
  onetimeInvitesAdmin: (page: number, limit: number) =>
    [...onetimeInvitesAdminAll(), page, limit] as const,
  onetimeInviteMemberStatsAdmin: () =>
    ["userGetOnetimeInviteMemberStatsAdmin"] as const,
  outreachPartnershipResponsesAdmin: () =>
    ["actionPartnershipsFindAllResponsesAdmin"] as const,
  reminderGroupClickRatesAdmin: () =>
    ["analyticsGetReminderGroupClickRatesAdmin"] as const,
  tagsAdmin: () => ["userGetTagsAdmin"] as const,
  timeSpentPerUserAdmin: () => ["analyticsGetTimeSpentPerUserAdmin"] as const,
  timeSpentPerUserTotalAdmin: () =>
    ["analyticsGetTimeSpentPerUserTotalAdmin"] as const,
  usersAdmin: () => ["userListAdmin"] as const,

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as const satisfies Record<string, (...args: any[]) => readonly unknown[]>;
