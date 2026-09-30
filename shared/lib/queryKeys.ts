import type {
  EventType,
  PreviewWaitlistEmailDto,
  WaitlistEntrySearchDto,
} from "../client/types.gen";
import type { UseActivitiesProps } from "./useActivities";

const activitiesAll = () => ["useActivities"] as const;

const onetimeInvitesAdminAll = () => ["userGetOnetimeInvitesAdmin"] as const;

/** Prefix over everything derived from a form definition, so one form write
 * invalidates the index and the per-form field lists together. */
const formsAdminAll = () => ["formsAdmin"] as const;

const projectsAdminAll = () => ["projectsAdmin"] as const;
const waitlistEmailPreviewAdminAll = () =>
  ["waitlistEmailAdminPreviewEmailAdmin"] as const;

const waitlistEntriesAdminAll = () =>
  ["waitlistAdminSearchEntriesAdmin"] as const;

const taskFormsAll = () => ["form"] as const;

const actionCompletionCurvesAdminAll = () =>
  ["analyticsGetActionCompletionCurvesAdmin"] as const;

/**
 * Central registry of react-query keys
 */
export const queryKeys = {
  actionUpdatesAll: () => ["actionsAllUpdates"] as const,
  actionUpdatesRecent: (limit: number) =>
    ["actionsRecentUpdates", limit] as const,
  /** Also prefixes generalUpdatesUnread, so invalidating it refetches that too. */
  actions: () => ["actions"] as const,
  activitiesAll,
  activities: ({
    list,
    objectId,
    limit,
    comments,
  }: UseActivitiesProps & { limit: number }) =>
    [
      ...activitiesAll(),
      list,
      objectId ?? "none",
      limit,
      comments ?? false,
    ] as const,
  allianceMemberCount: () => ["userNmembers"] as const,
  ambassadorInviteDashboard: () =>
    ["userGetAmbassadorInviteDashboard"] as const,
  communityMemberInfo: (
    communityId: number | undefined,
    userId: number | undefined,
  ) => ["communityMemberInfo", communityId ?? null, userId ?? null] as const,
  communityOnetimeInvites: (communityId: number) =>
    ["userGetOnetimeInvitesByCommunity", communityId] as const,
  contractById: (contractId: number | null) =>
    ["contractGetById", contractId] as const,
  currentContract: () => ["contractGetCurrent"] as const,
  forumPost: (postId: string | undefined) =>
    ["forumFindOnePost", postId] as const,
  generalUpdatesAll: () => ["actionsAllGeneralUpdates"] as const,
  generalUpdatesUnread: () => ["actions", "generalUpdates", "unread"] as const,
  linkPreview: (url: string) => ["linkPreviewGetPreview", url] as const,
  myAwayRanges: () => ["userGetAwayRanges"] as const,
  myReusableInvites: () => ["shareUrlsMyInvites"] as const,
  inviteMessageTemplate: () => ["shareUrlsInviteMessageTemplate"] as const,
  myVisibilityContext: () => ["userMyVisibilityContext"] as const,
  /** Prefixes the unread count and load time, so invalidating it invalidates
   * all three. */
  notifications: () => ["notifications"] as const,
  notificationsLoadedAt: () => ["notifications", "loadedAt"] as const,
  notificationsUnreadCount: () => ["notifications", "unreadCount"] as const,
  onetimeInvite: (code: string | null) => ["userOnetimeInvite", code] as const,
  onetimeInvitesOverview: () => ["userGetOnetimeInvitesOverview"] as const,
  publicCommunities: () => ["communityGetPublicCommunities"] as const,
  publicMembers: () => ["userMembersPublic"] as const,
  publicProfile: (userId: number) => ["userFindOne", userId] as const,
  referrerProfile: (code: string | null) =>
    ["userReferrerProfile", code] as const,
  signupSocialProof: (referralCode: string | null, count?: number) =>
    ["userSignupSocialProof", referralCode, count] as const,
  staffDirectory: () => ["userStaffDirectory"] as const,
  taskFormsAll,
  taskForm: (formId: number | null) => [...taskFormsAll(), formId] as const,
  waitlistBrowser: () => ["waitlistBrowser"] as const,
  waitlistCount: () => ["waitlistCount"] as const,
  waitlistMailConfig: () => ["waitlistMailConfig"] as const,
  waitlistReferral: (codes: { linkCode?: string; referrerCode?: string }) =>
    ["waitlistFindReferral", codes] as const,

  // Admin
  actionAdmin: (actionId: number | null) =>
    ["actionsFindOneAdmin", actionId] as const,
  actionCompletionCurvesAdminAll,
  actionCompletionCurvesAdmin: (granularity: string) =>
    [...actionCompletionCurvesAdminAll(), granularity] as const,
  actionStatsAdmin: () => ["analyticsGetActionStatsAdmin"] as const,
  actionsAllAdmin: () => ["actionsFindAllWithDraftsAdmin"] as const,
  actionCohortDecisionsAdmin: (actionId: number) =>
    ["cohortDecisionsListForActionAdmin", actionId] as const,
  actionRelationsAdmin: () => ["actionsActionRelationsAdmin"] as const,
  ambassadorProgramAdmin: () => ["userGetAmbassadorProgramAdmin"] as const,
  campaignsAdmin: () => ["campaignFindAllAdmin"] as const,
  clustersAdmin: () => ["clusterListAdmin"] as const,
  communitiesAdmin: () => ["communityGetCommunitiesAdmin"] as const,
  contractsAdmin: () => ["contractAllAdmin"] as const,
  eventLogAdmin: (page: number, limit: number, eventType: EventType | "") =>
    ["eventLogFindAllAdmin", page, limit, eventType] as const,
  externalShareTargetsAdmin: () => ["externalShareTargetsAdmin"] as const,
  formsAdminAll,
  formsAdmin: () => [...formsAdminAll(), "index"] as const,
  formQuestionFieldsAdmin: (formId: number | null) =>
    [...formsAdminAll(), "questionFields", formId] as const,
  formResponseCountsAdmin: (formIds: readonly number[]) =>
    [...formsAdminAll(), "responseCounts", formIds] as const,
  generalUpdatesAdmin: () => ["actionsAllGeneralUpdatesAdmin"] as const,
  memberContactInfoAdmin: () =>
    ["communityGetAllMemberContactInfoAdmin"] as const,
  onetimeInvitesAdminAll,
  onetimeInvitesAdmin: (page: number, limit: number) =>
    [...onetimeInvitesAdminAll(), page, limit] as const,
  onetimeInviteMemberStatsAdmin: () =>
    ["userGetOnetimeInviteMemberStatsAdmin"] as const,
  projectsAdminAll,
  projectsAdmin: () => [...projectsAdminAll(), "list"] as const,
  projectAdmin: (projectId: number) =>
    [...projectsAdminAll(), projectId] as const,
  outreachPartnershipResponsesAdmin: () =>
    ["actionPartnershipsFindAllResponsesAdmin"] as const,
  reminderGroupClickRatesAdmin: () =>
    ["analyticsGetReminderGroupClickRatesAdmin"] as const,
  scheduledPlansAdmin: () => ["actionsScheduledPlansAdmin"] as const,
  staffDirectoryAdmin: () => ["userStaffDirectoryAdmin"] as const,
  tagsAdmin: () => ["userGetTagsAdmin"] as const,
  timeSpentPerUserAdmin: () => ["analyticsGetTimeSpentPerUserAdmin"] as const,
  timeSpentPerUserTotalAdmin: () =>
    ["analyticsGetTimeSpentPerUserTotalAdmin"] as const,
  usersAdmin: () => ["userListAdmin"] as const,
  waitlistCohortsAdmin: () => ["waitlistAdminFindCohortsAdmin"] as const,
  waitlistEmailAdmin: (id: number) =>
    ["waitlistEmailAdminFindEmailAdmin", id] as const,
  waitlistEmailsAdmin: () => ["waitlistEmailAdminFindEmailsAdmin"] as const,
  waitlistEmailPreviewAdminAll,
  waitlistEmailPreviewAdmin: (preview: PreviewWaitlistEmailDto) =>
    [...waitlistEmailPreviewAdminAll(), preview] as const,
  waitlistEmailTemplatesAdmin: () =>
    ["waitlistEmailAdminFindTemplatesAdmin"] as const,
  waitlistEntriesAdminAll,
  waitlistEntriesAdmin: (search: WaitlistEntrySearchDto) =>
    [...waitlistEntriesAdminAll(), search] as const,
  waitlistLinksAdmin: () => ["waitlistAdminFindLinksAdmin"] as const,
  waitlistTagsAdmin: () => ["waitlistAdminFindTagsAdmin"] as const,
  videoAdmin: (videoId: number) =>
    ["videosGetVideoDetailsAdmin", videoId] as const,
  videosAdmin: () => ["videosListVideosAdmin"] as const,
  welcomeQueueAdmin: () => ["actionsGetWelcomeQueueAdmin"] as const,

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as const satisfies Record<string, (...args: any[]) => readonly unknown[]>;
