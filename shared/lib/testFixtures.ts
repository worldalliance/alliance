import { milliseconds } from "date-fns";
import type {
  ActionActivityDto,
  ActionEventDto,
  CommunityDto,
  CommunityInviteDto,
  ConversationDto,
  ConversationType,
  FormResponseDto,
  KindSettingsDto,
  MessageDto,
  NotificationSettingsDto,
  OnetimeInviteDto,
  ParticipantDto,
  ParticipantRole,
  ProfileDto,
  ShareUrlMineDto,
  TagDto,
  UserActionStatusDto,
  UserDto,
} from "../client/types.gen";
import type { ActionWithAwayStatus } from "./actionUtils";

// Test-only fixture builders shared by the unit suites. The action builders
// default to a plain assigned todo in the member-action phase, expressed
// through the server-computed `viewer` status; `makeLegacyAction` re-expresses
// the same action through the legacy flat fields (no `viewer`) for the
// fallback paths.

export function makeViewer(
  overrides: Partial<UserActionStatusDto> = {},
): UserActionStatusDto {
  return {
    assigned: true,
    optional: false,
    optionalReason: null,
    contractGap: overrides.optionalReason === "contract_gap",
    canComplete: true,
    relation: "none",
    dismissed: false,
    away: "not_away",
    memberActionStarted: true,
    deadlineAt: null,
    deadlinePassed: false,
    staffPreview: false,
    display: "todo",
    ...overrides,
  };
}

export function makeViewerWithUnknownOptionalReason(): UserActionStatusDto {
  return makeViewer({
    optional: true,
    // @ts-expect-error: a reason from a server newer than this build
    optionalReason: "from_a_newer_server",
  });
}

export function makeAction(
  overrides: Partial<ActionWithAwayStatus> = {},
): ActionWithAwayStatus {
  // The server builds the viewer status from the action, so an `optional`
  // override has to reach the default viewer or the fixture describes a
  // payload no response can carry.
  const optional = overrides.optional ?? false;
  return {
    id: 1,
    name: "Test action",
    category: [],
    body: "",
    shortDescription: "",
    timeEstimate: null,
    squareThumbnailImageAlt: null,
    customStatType: "none",
    customStatValue: null,
    customStatGoal: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    isContractSigningAction: false,
    visibilityMode: "all_members",
    usersJoined: 0,
    usersCompleted: 0,
    priority: 0,
    optional,
    preventCompletion: false,
    isForumParticipationAction: false,
    forumParticipationPostId: null,
    forumParticipationIncludeChildren: false,
    computedAutocompleteAt: null,
    archived: false,
    followUpForms: [],
    reviewers: [],
    updates: [],
    status: "member_action",
    publicOnly: false,
    reqAuthenticated: true,
    canParticipate: true,
    onboarding: false,
    shouldCompleteAfterDeadline: false,
    awayStatus: "not_away",
    events: [],
    viewer: makeViewer({ optional }),
    ...overrides,
  };
}

export function makeEvent(
  overrides: Partial<ActionEventDto> = {},
): ActionEventDto {
  return {
    id: 1,
    title: "",
    description: "",
    newStatus: "member_action",
    date: new Date(Date.now() - milliseconds({ seconds: 1 })).toISOString(),
    suiteManaged: false,
    ...overrides,
  };
}

/** The same action expressed through the legacy flat fields, no `viewer`. */
export function makeLegacyAction(
  overrides: Partial<ActionWithAwayStatus> = {},
): ActionWithAwayStatus {
  return makeAction({
    viewer: undefined,
    shouldParticipate: true,
    userRelation: "none",
    events: [makeEvent()],
    ...overrides,
  });
}

export function makeProfile(id: number): ProfileDto {
  return {
    id,
    admin: false,
    staff: false,
    ambassador: false,
    profilePicture: null,
    profileDescription: null,
    anonymous: false,
    displayName: `User ${id}`,
    hasActiveContract: true,
    isCommunityLeader: false,
  };
}

export function makeTag(overrides: Partial<TagDto> = {}): TagDto {
  return {
    id: "tag-1",
    name: "Volunteers",
    description: "",
    publicDisplayName: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    users: [],
    ...overrides,
  };
}

export function makeActivity(
  overrides: Partial<ActionActivityDto> = {},
): ActionActivityDto {
  return {
    id: 1,
    type: "user_completed",
    actionId: 1,
    actionName: "Test action",
    createdAt: "2026-01-01T00:00:00.000Z",
    likesCount: 0,
    likedByMe: false,
    likes: [],
    user: makeProfile(1),
    comments: [],
    editableContent: { body: "", attachments: [] },
    ...overrides,
  };
}

export function makeCommunity(
  overrides: Partial<CommunityDto> = {},
): CommunityDto {
  return {
    id: 1,
    name: "Ada's group",
    description: "A group",
    photo: null,
    public: false,
    allowMemberInvites: true,
    allowStaffAssignments: true,
    maxCapacity: 10,
    users: [],
    leaders: [],
    ...overrides,
  };
}

export function makeParticipant(
  id: number,
  role: ParticipantRole,
): ParticipantDto {
  return { role, state: "joined", user: makeProfile(id) };
}

export function makeConversation(
  participants: ParticipantDto[],
  type: ConversationType = "multiple",
): ConversationDto {
  return {
    id: 1,
    createdAt: "2026-09-17T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z",
    type,
    title: "Group",
    participants,
    hasUnread: false,
    isMessageRequest: false,
    unreadCount: 0,
  };
}

export function makeMessage(overrides: Partial<MessageDto> = {}): MessageDto {
  return {
    id: "m1",
    body: "Hello",
    attachments: [],
    createdAt: "2026-10-01T00:00:00.000Z",
    deletedAt: null,
    author: makeProfile(2),
    conversationId: 1,
    ...overrides,
  };
}

export function makeUser(overrides: Partial<UserDto> = {}): UserDto {
  return {
    id: 1,
    name: "Ada Member",
    email: "ada@example.com",
    phoneNumber: null,
    preferredReminderTime: null,
    timeZone: null,
    customCityString: null,
    admin: false,
    referralCode: "ref",
    referralSource: "onetime_invite",
    referredById: null,
    referredByCampaignId: null,
    anonymous: false,
    switchedDomainAt: null,
    staff: false,
    ambassador: false,
    hasActiveContract: false,
    shareEmailWithCommunityLead: false,
    sharePhoneNumberWithCommunityLead: false,
    profilePicture: null,
    profileDescription: null,
    communities: [],
    tags: [],
    formDataPreference: "public",
    shareInfoPublicly: false,
    undergoingGroupAssignment: false,
    leaderOfIds: [],
    clusterId: null,
    hasPassword: true,
    oauthAccounts: [],
    ...overrides,
  };
}

export function makeFormResponse(
  overrides: Partial<FormResponseDto> = {},
): FormResponseDto {
  return {
    id: 1,
    formId: 1,
    formSnapshotId: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    answers: {},
    publicAnswers: {},
    schemaSnapshot: {},
    assignedRow: null,
    phDistinctId: null,
    deviceType: null,
    sessionReplayUrl: null,
    sid: null,
    visibilityValidatorResults: {},
    formulaChoices: {},
    ...overrides,
  };
}

export function makeOnetimeInvite(
  overrides: Partial<OnetimeInviteDto> = {},
): OnetimeInviteDto {
  return {
    id: 1,
    invitee: "Sam",
    inviteeDescription: null,
    info: null,
    code: "abc123",
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "link_unused",
    invitedUserId: null,
    accepted: false,
    ...overrides,
  };
}

export function makeCommunityInvite(
  overrides: Partial<CommunityInviteDto> = {},
): CommunityInviteDto {
  return {
    id: 1,
    status: "invitee_pending",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    community: makeCommunity(),
    invitedUser: makeProfile(2),
    invitingUser: makeProfile(1),
    ...overrides,
  };
}

export function makeShareUrlMine(
  overrides: Partial<ShareUrlMineDto> = {},
): ShareUrlMineDto {
  return {
    id: "share-url-id",
    url: "https://example.com/signup?ref=share-abc",
    label: null,
    duplicate: true,
    sid: "share-abc",
    createdAt: "2026-01-01T00:00:00.000Z",
    signupCount: 0,
    assignmentKind: "automatic",
    communityId: null,
    communityName: null,
    ...overrides,
  };
}

export function makeKindSettings(
  overrides: Partial<KindSettingsDto> = {},
): KindSettingsDto {
  return {
    kind: "likes",
    label: "Likes",
    section: "friends_and_likes",
    required: false,
    example: "Jordan Ellis liked your post",
    cells: [
      { channel: "in_app", override: null, enabled: true, editable: true },
      { channel: "push", override: null, enabled: true, editable: true },
    ],
    ...overrides,
  };
}

export function makeNotificationSettings(
  overrides: Partial<NotificationSettingsDto> = {},
): NotificationSettingsDto {
  return {
    defaults: { inApp: true, push: true, text: true, email: true },
    kinds: [makeKindSettings()],
    reachability: { textablePhoneNumber: true, textStopped: false },
    ...overrides,
  };
}
