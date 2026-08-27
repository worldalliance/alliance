// Strongly-typed PostHog event names, shared across server, web, and mobile.
export enum AnalyticsEvent {
  // Actions
  ActionCompleted = "action_completed",
  FormStarted = "form_started",

  // Forms
  FormPageViewed = "form_page_viewed",
  FormPageExited = "form_page_exited",
  FormValidationError = "form_validation_error",

  // Video
  VideoSeen = "video_seen",
  VideoStarted = "video_started",
  VideoProgress = "video_progress",
  VideoFullyWatched = "video_fully_watched",

  // Activities / forum
  ActivityLiked = "activity_liked",
  ForumCommentLiked = "forum_comment_liked",

  // Notifications
  NotificationClicked = "notification_clicked",
  NotificationReadViaClick = "notification_read_via_click",
  NotificationMarkedRead = "notification_marked_read",
  NotificationsMarkedAllAsRead = "notifications_marked_all_as_read",
  NotifLinkClick = "notif_link_click",

  // Signup / invites
  InvitePageOpened = "invite_page_opened",
  NewUser = "new_user",
  SidLoad = "sid_load",

  // Auth
  AuthFailedToRefresh = "auth_failed_to_refresh",
  Login = "login",
  Logout = "logout",

  // OTA updates
  OtaGateResolved = "ota_gate_resolved",

  // Visible actions (server-side). Each is forwarded to Slack.
  ForumPostCreated = "forum_post_created",
  ForumCommentCreated = "forum_comment_created",
  ForumPostLiked = "forum_post_liked",
  ForumPostUnliked = "forum_post_unliked",
  ForumCommentUnliked = "forum_comment_unliked",
  ActivityCommentCreated = "activity_comment_created",
  ActivityUnliked = "activity_unliked",
  ActionOptedOut = "action_opted_out",
  ContractSigned = "contract_signed",
  ContractSuspended = "contract_suspended",
  CommunityCreated = "community_created",
  CommunityJoined = "community_joined",
  CommunityLeft = "community_left",
  CommunityInviteCreated = "community_invite_created",
  CommunityInviteRequested = "community_invite_requested",
  CommunityInviteApproved = "community_invite_approved",
  OnetimeInviteCreated = "onetime_invite_created",
  OnetimeInviteRequested = "onetime_invite_requested",
  OnetimeInviteApproved = "onetime_invite_approved",
  FriendRequestSent = "friend_request_sent",
  FriendRequestAccepted = "friend_request_accepted",
  FriendRemoved = "friend_removed",
  ConversationCreated = "conversation_created",
  MessageSent = "message_sent",

  // Email (Mailgun webhook). Unrecognized Mailgun event types fall back to a
  // dynamic `email<event>` name
  EmailDelivered = "emaildelivered",
  EmailOpened = "emailopened",
  EmailClicked = "emailclicked",
  EmailBounced = "emailbounced",
  EmailComplained = "emailcomplained",
  EmailUnsubscribed = "emailunsubscribed",

  // Server
  DbSlowQuery = "db.slow_query",
}

/**
 * The `outcome` property of {@link AnalyticsEvent.OtaGateResolved}: why the
 * mobile cold-start gate stopped blocking.
 *
 * Applying reports `applied` up front, since a reload that works never comes
 * back to report anything, and a reload that then fails or stalls emits a
 * second row naming `applied` in `supersedes`. So count launches with
 * `restart_count = 0`, and updates that landed as `applied` rows minus rows
 * with `supersedes = 'applied'`.
 */
export enum OtaGateOutcome {
  NoUpdate = "no_update",
  Applied = "applied",
  CheckTimedOut = "check_timed_out",
  DownloadTimedOut = "download_timed_out",
  Skipped = "skipped",
  CheckError = "check_error",
  DownloadError = "download_error",
  /** `reloadAsync` rejected. */
  ReloadFailed = "reload_failed",
  /** `reloadAsync` resolved but the reload never landed. */
  ReloadStalled = "reload_stalled",
  /** The startup procedure ended mid-download, pending nothing and reporting no error. */
  DownloadIncomplete = "download_incomplete",
  /** This runtime came from a reload. */
  Relaunched = "relaunched",
  /** A notification tap is waiting to be handled, and a reload would discard it. */
  NotificationLaunch = "notification_launch",
}

// Strongly-typed labels for exceptions reported via `captureException`.
export enum ExceptionEvent {
  FormSubmitError = "form_submit_error",
  FollowUpFormSubmitError = "follow_up_form_submit_error",
  PostReplyError = "post_reply_error",
  OtaGateCrashed = "ota_gate_crashed",
}

export const SLACK_PROPERTY = "send_to_slack";

// Events that should be forwarded to Slack.
export const SEND_TO_SLACK: Record<AnalyticsEvent | ExceptionEvent, boolean> = {
  // Actions
  [AnalyticsEvent.ActionCompleted]: true,
  [AnalyticsEvent.FormStarted]: false,

  // Forms
  [AnalyticsEvent.FormPageViewed]: false,
  [AnalyticsEvent.FormPageExited]: false,
  [AnalyticsEvent.FormValidationError]: false,

  // Video
  [AnalyticsEvent.VideoSeen]: false,
  [AnalyticsEvent.VideoStarted]: false,
  [AnalyticsEvent.VideoProgress]: false,
  [AnalyticsEvent.VideoFullyWatched]: false,

  // Activities / forum
  [AnalyticsEvent.ActivityLiked]: true,
  [AnalyticsEvent.ForumCommentLiked]: true,

  // Notifications
  [AnalyticsEvent.NotificationClicked]: false,
  [AnalyticsEvent.NotificationReadViaClick]: false,
  [AnalyticsEvent.NotificationMarkedRead]: false,
  [AnalyticsEvent.NotificationsMarkedAllAsRead]: false,
  [AnalyticsEvent.NotifLinkClick]: false,

  // Signup / invites
  [AnalyticsEvent.InvitePageOpened]: false,
  [AnalyticsEvent.NewUser]: true,
  [AnalyticsEvent.SidLoad]: false,

  // Auth
  [AnalyticsEvent.AuthFailedToRefresh]: false,
  [AnalyticsEvent.Login]: true,
  [AnalyticsEvent.Logout]: true,

  // OTA updates
  [AnalyticsEvent.OtaGateResolved]: false,

  // Visible actions (server-side)
  [AnalyticsEvent.ForumPostCreated]: true,
  [AnalyticsEvent.ForumCommentCreated]: true,
  [AnalyticsEvent.ForumPostLiked]: true,
  [AnalyticsEvent.ForumPostUnliked]: true,
  [AnalyticsEvent.ForumCommentUnliked]: true,
  [AnalyticsEvent.ActivityCommentCreated]: true,
  [AnalyticsEvent.ActivityUnliked]: true,
  [AnalyticsEvent.ActionOptedOut]: true,
  [AnalyticsEvent.ContractSigned]: true,
  [AnalyticsEvent.ContractSuspended]: true,
  [AnalyticsEvent.CommunityCreated]: true,
  [AnalyticsEvent.CommunityJoined]: true,
  [AnalyticsEvent.CommunityLeft]: true,
  [AnalyticsEvent.CommunityInviteCreated]: true,
  [AnalyticsEvent.CommunityInviteRequested]: true,
  [AnalyticsEvent.CommunityInviteApproved]: true,
  [AnalyticsEvent.OnetimeInviteCreated]: true,
  [AnalyticsEvent.OnetimeInviteRequested]: true,
  [AnalyticsEvent.OnetimeInviteApproved]: true,
  [AnalyticsEvent.FriendRequestSent]: true,
  [AnalyticsEvent.FriendRequestAccepted]: true,
  [AnalyticsEvent.FriendRemoved]: true,
  [AnalyticsEvent.ConversationCreated]: true,
  [AnalyticsEvent.MessageSent]: true,

  // Email (Mailgun webhook)
  [AnalyticsEvent.EmailDelivered]: false,
  [AnalyticsEvent.EmailOpened]: false,
  [AnalyticsEvent.EmailClicked]: false,
  [AnalyticsEvent.EmailBounced]: false,
  [AnalyticsEvent.EmailComplained]: false,
  [AnalyticsEvent.EmailUnsubscribed]: false,

  // Server
  [AnalyticsEvent.DbSlowQuery]: false,

  // Exceptions
  [ExceptionEvent.FormSubmitError]: false,
  [ExceptionEvent.FollowUpFormSubmitError]: false,
  [ExceptionEvent.PostReplyError]: false,
  [ExceptionEvent.OtaGateCrashed]: true,
};
