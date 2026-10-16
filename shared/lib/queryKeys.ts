import type { CohortExpression } from "@alliance/common/cohort-expression";
import type {
  EventType,
  InviteLinkKind,
  InviteLinkSort,
  PreviewEmailHtmlDto,
  PreviewTextDto,
  PreviewWaitlistEmailDto,
  WaitlistEntryFilterDto,
  WaitlistEntrySearchDto,
} from "../client/types.gen";
import type { UseActivitiesProps } from "./useActivities";

const activitiesAll = () => ["useActivities"] as const;

const onetimeInvitesAdminAll = () =>
  ["userOnetimeInviteGetOnetimeInvitesAdmin"] as const;

/** Prefix over everything derived from a form definition, so one form write
 * invalidates the index and the per-form field lists together. */
const formsAdminAll = () => ["formsAdmin"] as const;

const projectsAdminAll = () => ["projectsAdmin"] as const;

/** Prefix over a group's member progress and contact info, so a membership
 * change refreshes both. */
const communityMemberInfoAdminAll = (communityId: number | null) =>
  ["communityMemberInfoAdmin", communityId] as const;

const waitlistEmailPreviewAdminAll = () =>
  ["waitlistEmailAdminPreviewEmailAdmin"] as const;

/** Prefix over the entry list and its metrics, so a change to entries
 * refreshes both. */
const waitlistEntriesAdminAll = () =>
  ["waitlistAdminSearchEntriesAdmin"] as const;

const taskFormsAll = () => ["form"] as const;

const actionCompletionCurvesAdminAll = () =>
  ["analyticsGetActionCompletionCurvesAdmin"] as const;

const actionReminderGroupsAdminAll = () =>
  ["actionReminderGroupsAdmin"] as const;

/**
 * Central registry of react-query keys
 */
export const queryKeys = {
  action: (actionId: number | null) => ["actionsFindOne", actionId] as const,
  actionUpdatesAll: () => ["actionUpdatesAllUpdates"] as const,
  actionUpdatesRecent: (limit: number) =>
    ["actionUpdatesRecentUpdates", limit] as const,
  /** Also prefixes generalUpdatesUnread, so invalidating it refetches that too. */
  actions: () => ["actions"] as const,
  activitiesAll,
  activity: (activityId: number) =>
    ["actionFeedGetActivity", activityId] as const,
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
  communityConversation: (communityId: number | null) =>
    ["conversationGetCommunityConversations", communityId] as const,
  communityCompletedActionsCount: (communityId: number | null) =>
    ["actionsCommunityCompletedActionsCount", communityId] as const,
  communityInvites: (communityId: number) =>
    ["communityGetCommunityInvites", communityId] as const,
  communityMemberInfo: (
    communityId: number | undefined,
    userId: number | undefined,
  ) => ["communityMemberInfo", communityId ?? null, userId ?? null] as const,
  communityMemberContactInfo: (communityId: number | null) =>
    ["communityGetMemberContactInfo", communityId] as const,
  communityOnetimeInvites: (communityId: number) =>
    ["userOnetimeInviteGetOnetimeInvitesByCommunity", communityId] as const,
  contractById: (contractId: number | null) =>
    ["contractGetById", contractId] as const,
  conversationMessages: (conversationId: number | null) =>
    ["messageGetMessages", conversationId] as const,
  currentContract: () => ["contractGetCurrent"] as const,
  forumPost: (postId: string | undefined) =>
    ["forumFindOnePost", postId] as const,
  forumPosts: () => ["forumFindAllPosts"] as const,
  generalUpdatesAll: () => ["generalUpdatesAllGeneralUpdates"] as const,
  generalUpdatesUnread: () => ["actions", "generalUpdates", "unread"] as const,
  incomingCommunityInvites: () =>
    ["communityGetIncomingCommunityInvitesForUser"] as const,
  linkedGuestDraft: (taskFormId: number) =>
    ["tasksGetLinkedGuestDraft", taskFormId] as const,
  linkPreview: (url: string) => ["linkPreviewGetPreview", url] as const,
  members: () => ["userMembers"] as const,
  membersWithFriends: () => ["userMembersWithFriends"] as const,
  myAwayRanges: () => ["userAwayRangeGetAwayRanges"] as const,
  myCommunities: () => ["communityGetMyCommunities"] as const,
  myConversations: () => ["conversationGetMyConversations"] as const,
  myReusableInvites: () => ["shareUrlsMyInvites"] as const,
  inviteMessageTemplate: () => ["shareUrlsInviteMessageTemplate"] as const,
  myVisibilityContext: () => ["userMyVisibilityContext"] as const,
  /** Prefixes the unread count and load time, so invalidating it invalidates
   * all three. */
  notifications: () => ["notifications"] as const,
  notificationsLoadedAt: () => ["notifications", "loadedAt"] as const,
  notificationsUnreadCount: () => ["notifications", "unreadCount"] as const,
  onetimeInvite: (code: string | null) =>
    ["userOnetimeInviteOnetimeInvite", code] as const,
  onetimeInvitesOverview: () =>
    ["userOnetimeInviteGetOnetimeInvitesOverview"] as const,
  publicCommunities: () => ["communityGetPublicCommunities"] as const,
  publicMembers: () => ["userMembersPublic"] as const,
  publicProfile: (userId: number) => ["userFindOne", userId] as const,
  referrerProfile: (code: string | null) =>
    ["userReferralReferrerProfile", code] as const,
  signupSocialProof: (referralCode: string | null, count?: number) =>
    ["userReferralSignupSocialProof", referralCode, count] as const,
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
  actionIncompleteUsersAdmin: (actionId: number | null) =>
    ["actionsGetIncompleteUsersAdmin", actionId] as const,
  actionShareUrlStatsAdmin: (actionId: number | null) =>
    ["actionsShareUrlStatsAdmin", actionId] as const,
  actionStatsAdmin: () => ["analyticsGetActionStatsAdmin"] as const,
  actionStatsByIdAdmin: (actionId: number | null) =>
    ["analyticsGetActionStatsByIdAdmin", actionId] as const,
  actionUpdateAdmin: (id: number | null) =>
    ["actionUpdatesFindOneUpdateAdmin", id] as const,
  actionUpdateRecognitionPreviewCountsAdmin: (
    id: number,
    audience: { notifyType: string; tagId: string | null },
  ) =>
    ["actionUpdatesPreviewUpdateRecognitionCountsAdmin", id, audience] as const,
  actionSuiteAdmin: (suiteId: number) =>
    ["actionSuitesSuiteAdmin", suiteId] as const,
  actionSuitesAdmin: () => ["actionSuitesSuitesAdmin"] as const,
  actionsAllAdmin: () => ["actionsFindAllWithDraftsAdmin"] as const,
  actionCohortDecisionsAdmin: (actionId: number) =>
    ["cohortDecisionsListForActionAdmin", actionId] as const,
  actionRelationsAdmin: () => ["actionsActionRelationsAdmin"] as const,
  actionReminderGroupsAdminEvents: () =>
    [...actionReminderGroupsAdminAll(), "event"] as const,
  actionReminderGroupsAdmin: (eventId: number | null) =>
    [...actionReminderGroupsAdminAll(), "event", eventId] as const,
  actionReminderGroupDetailsAdminAll: () =>
    [...actionReminderGroupsAdminAll(), "group"] as const,
  actionReminderGroupDetailsAdmin: (groupId: number) =>
    [...actionReminderGroupsAdminAll(), "group", groupId] as const,
  actionReminderAnchorCandidatesAdmin: (eventId: number | null) =>
    ["actionRemindersReminderAnchorCandidatesAdmin", eventId] as const,
  ambassadorProgramAdmin: () => ["userGetAmbassadorProgramAdmin"] as const,
  campaignsAdmin: () => ["campaignFindAllAdmin"] as const,
  clustersAdmin: () => ["clusterListAdmin"] as const,
  cohortEvaluationAdmin: (expression: CohortExpression | null) =>
    ["actionsEvaluateCohortAdmin", expression] as const,
  communitiesAdmin: () => ["communityGetCommunitiesAdmin"] as const,
  communityMemberInfoAdminAll,
  communityMemberInfoAdmin: (communityId: number | null) =>
    [...communityMemberInfoAdminAll(communityId), "progress"] as const,
  communityMemberContactInfoAdmin: (communityId: number | null) =>
    [...communityMemberInfoAdminAll(communityId), "contactInfo"] as const,
  contractAdmin: (id: number | null) => ["contractFindOneAdmin", id] as const,
  contractsAdmin: () => ["contractAllAdmin"] as const,
  contractStatusHistoryAdmin: (range: { start: string; end: string }) =>
    ["analyticsGetContractStatusHistoryAdmin", range] as const,
  customValidatorAdmin: (id: number) =>
    ["tasksFindOneCustomValidatorAdmin", id] as const,
  dailyStatsAdmin: (range: { start: string; end: string }) =>
    ["analyticsGetDailyStatsAdmin", range] as const,
  eventLogAdmin: (page: number, limit: number, eventType: EventType | "") =>
    ["eventLogFindAllAdmin", page, limit, eventType] as const,
  externalShareTargetsAdmin: () => ["externalShareTargetsAdmin"] as const,
  customLinksAdmin: () => ["customLinksAdmin"] as const,
  hostedDocsAdmin: () => ["hostedDocsAdmin"] as const,
  formsAdminAll,
  formResponsesAdmin: (formId: number | null) =>
    ["tasksGetFormResponsesAdmin", formId] as const,
  formResponsesByFormsAdmin: (formIds: readonly number[] | null) =>
    ["tasksGetFormResponsesByFormsAdmin", formIds] as const,
  formShareLinksAdmin: (formId: number | null) =>
    ["actionsShareLinksForFormAdmin", formId] as const,
  formWithdrawalsAdmin: (formId: number | null) =>
    ["actionsGetWithdrawalsAdmin", formId] as const,
  formsAdmin: () => [...formsAdminAll(), "index"] as const,
  formVariantsAdmin: (actionId: number) =>
    ["actionFormsListFormVariantsAdmin", actionId] as const,
  formQuestionFieldsAdmin: (formId: number | null) =>
    [...formsAdminAll(), "questionFields", formId] as const,
  formResponseCountsAdmin: (formIds: readonly number[]) =>
    [...formsAdminAll(), "responseCounts", formIds] as const,
  friendGraphEdgesAdmin: () => ["userFriendGetFriendGraphEdgesAdmin"] as const,
  generalUpdateAdmin: (id: number | null) =>
    ["generalUpdatesFindOneGeneralUpdateAdmin", id] as const,
  generalUpdatesAdmin: () => ["generalUpdatesAllGeneralUpdatesAdmin"] as const,
  graphUsersAdmin: () => ["userListForGraphAdmin"] as const,
  groupAssignmentMembersAdmin: () =>
    ["userGroupAssignmentGetGroupAssignmentMembersAdmin"] as const,
  inviteFeedAdmin: (startAt: string | null) =>
    ["inviteFeedAdmin", startAt] as const,
  inviteFunnelAdmin: (range: { start: string; end: string }) =>
    ["analyticsGetInviteFunnelAdmin", range] as const,
  inviteLinksAdmin: (query: {
    kind: InviteLinkKind | undefined;
    sort: InviteLinkSort;
    page: number;
    limit: number;
  }) => ["inviteLinkAdminSearch", query] as const,
  memberContactInfoAdmin: () =>
    ["communityGetAllMemberContactInfoAdmin"] as const,
  onetimeInvitesAdminAll,
  onetimeInvitesAdmin: (page: number, limit: number) =>
    [...onetimeInvitesAdminAll(), page, limit] as const,
  onetimeInviteMemberStatsAdmin: () =>
    ["userOnetimeInviteGetOnetimeInviteMemberStatsAdmin"] as const,
  onetimeInviteGraphEdgesAdmin: () =>
    ["userOnetimeInviteGetOnetimeInviteGraphEdgesAdmin"] as const,
  platformTenureCohortAdmin: (weeksOnPlatform: number | null) =>
    ["analyticsGetPlatformTenureCohortAdmin", weeksOnPlatform] as const,
  postsAdmin: () => ["forumGetPostsForAdmin"] as const,
  projectsAdminAll,
  projectsAdmin: () => [...projectsAdminAll(), "list"] as const,
  projectAdmin: (projectId: number) =>
    [...projectsAdminAll(), projectId] as const,
  outreachPartnershipResponsesAdmin: () =>
    ["actionPartnershipsFindAllResponsesAdmin"] as const,
  reminderEmailPreviewAdmin: (
    eventId: number | null,
    preview: PreviewEmailHtmlDto | null,
  ) => ["actionRemindersPreviewEmailHtmlAdmin", eventId, preview] as const,
  reminderGroupClickRatesAdmin: () =>
    ["analyticsGetReminderGroupClickRatesAdmin"] as const,
  reminderTextPreviewAdmin: (
    eventId: number | null,
    preview: PreviewTextDto | null,
  ) => ["actionRemindersPreviewTextMessageAdmin", eventId, preview] as const,
  responseSnapshotMigrationAdmin: (formId: number | null) =>
    ["tasksGetResponseSnapshotMigrationAdmin", formId] as const,
  scheduledPlansAdmin: () => ["actionsScheduledPlansAdmin"] as const,
  shareLinksAdmin: (owner: { type: string; id: number } | null) =>
    [
      "shareUrlsFindForOwnerAdmin",
      owner?.type ?? null,
      owner?.id ?? null,
    ] as const,
  staffDirectoryAdmin: () => ["userStaffDirectoryAdmin"] as const,
  tagsAdmin: () => ["userTagGetTagsAdmin"] as const,
  timeSpentPerUserTotalAdmin: () =>
    ["analyticsGetTimeSpentPerUserTotalAdmin"] as const,
  userAwayRangesAdmin: (userId: number) =>
    ["userAwayRangeGetAwayRangeForUserAdmin", userId] as const,
  userCityCountsAdmin: () => ["userCityCountsAdmin"] as const,
  userDetailAdmin: (userId: number) => ["userUserDetailAdmin", userId] as const,
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
  waitlistEntryMetricsAdmin: (filter: WaitlistEntryFilterDto) =>
    [...waitlistEntriesAdminAll(), "metrics", filter] as const,
  waitlistLinksAdmin: () => ["waitlistAdminFindLinksAdmin"] as const,
  waitlistTagsAdmin: () => ["waitlistAdminFindTagsAdmin"] as const,
  videoAdmin: (videoId: number) =>
    ["videosGetVideoDetailsAdmin", videoId] as const,
  videosAdmin: () => ["videosListVideosAdmin"] as const,
  welcomeQueueAdmin: () => ["actionsGetWelcomeQueueAdmin"] as const,

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as const satisfies Record<string, (...args: any[]) => readonly unknown[]>;
