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
  ambassadorProgramAdmin: () => ["userGetAmbassadorProgramAdmin"] as const,
  reminderGroupClickRatesAdmin: () =>
    ["analyticsGetReminderGroupClickRatesAdmin"] as const,
} as const;
