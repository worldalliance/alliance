import { RetiredColumn } from "src/utils/retired-column";

// TODO: drop these columns and this class in a deploy after this one. Until
// then a rollback restores the previous release, which inserts them.
export abstract class UserRetiredColumns {
  @RetiredColumn({
    name: "forumDigestPreference",
    type: "enum",
    enum: ["off", "daily", "weekly"],
  })
  legacyForumDigestPreference: string | null;

  @RetiredColumn({
    name: "socialNotifsPreference",
    type: "enum",
    enum: ["all", "digest", "none"],
  })
  legacySocialNotifsPreference: string | null;

  @RetiredColumn({ name: "emailNotifsForActions", type: "boolean" })
  legacyEmailNotifsForActions: boolean | null;

  @RetiredColumn({ name: "textNotifsForActions", type: "boolean" })
  legacyTextNotifsForActions: boolean | null;

  @RetiredColumn({ name: "pushNotifsForActions", type: "boolean" })
  legacyPushNotifsForActions: boolean | null;

  @RetiredColumn({ name: "turnedOffAllNotifs", type: "boolean" })
  legacyTurnedOffAllNotifs: boolean | null;

  @RetiredColumn({ name: "pushesForLikes", type: "boolean" })
  legacyPushesForLikes: boolean | null;

  @RetiredColumn({ name: "pushesForComments", type: "boolean" })
  legacyPushesForComments: boolean | null;

  @RetiredColumn({ name: "pushesForFriendRequests", type: "boolean" })
  legacyPushesForFriendRequests: boolean | null;

  @RetiredColumn({ name: "pushesForMessages", type: "boolean" })
  legacyPushesForMessages: boolean | null;

  @RetiredColumn({ name: "pushesForActionUpdates", type: "boolean" })
  legacyPushesForActionUpdates: boolean | null;

  @RetiredColumn({ name: "pushesForNewGroupMembers", type: "boolean" })
  legacyPushesForNewGroupMembers: boolean | null;

  @RetiredColumn({ name: "textsForNewGroupMembers", type: "boolean" })
  legacyTextsForNewGroupMembers: boolean | null;

  @RetiredColumn({
    name: "remindAboutUncompletedGroupMembers",
    type: "boolean",
  })
  legacyRemindAboutUncompletedGroupMembers: boolean | null;

  @RetiredColumn({ name: "receiveReplyNotifications", type: "boolean" })
  legacyReceiveReplyNotifications: boolean | null;
}
