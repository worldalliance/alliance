import { NotificationKind } from "src/notification-settings/notification-kind";
import {
  NotificationPreference,
  PreferenceSource,
} from "src/notification-settings/notification-preference.entity";
import { ReferralSource, User } from "src/user/entities/user.entity";
import { NotificationPreferences1792214215796 } from "../migrations/1792214215796-NotificationPreferences";
import { createTestApp, TestContext } from "./e2e-test-utils";

const GROUP_NOTICES = [
  NotificationKind.MemberJoinedCommunity,
  NotificationKind.CommunityAssigned,
  NotificationKind.RemovedFromCommunity,
  NotificationKind.RemovedFromCommunityForLeader,
  NotificationKind.MemberLeftCommunity,
  NotificationKind.MemberSuspendedRemovedFromCommunity,
  NotificationKind.NewMemberReferred,
  NotificationKind.RecruitingGoals,
  NotificationKind.CommunityInviteCreated,
  NotificationKind.CommunityInviteAccepted,
  NotificationKind.CommunityInviteRejected,
  NotificationKind.CommunityInviteRequestCreated,
  NotificationKind.CommunityInviteRequestApproved,
  NotificationKind.CommunityInviteRequestRejected,
  NotificationKind.OnetimeInviteRequestCreated,
  NotificationKind.OnetimeInviteRequestApproved,
  NotificationKind.OnetimeInviteRequestRejected,
];

const PUSH_TOGGLES = [
  NotificationKind.ActionUpdates,
  NotificationKind.CommentsAndReplies,
  NotificationKind.Messages,
  NotificationKind.FriendRequests,
  NotificationKind.FriendRequestAccepted,
  NotificationKind.Likes,
  NotificationKind.GroupMemberJoined,
];

type Defaults = Pick<
  User,
  "pushByDefault" | "textByDefault" | "emailByDefault"
>;

const ON: Defaults = {
  pushByDefault: true,
  textByDefault: true,
  emailByDefault: true,
};

const cases: {
  name: string;
  old: Partial<User>;
  defaults: Defaults;
  overrides: string[];
}[] = [
  {
    name: "every old setting at its default",
    old: {},
    defaults: ON,
    overrides: ["group_member_joined:text:false"],
  },
  {
    name: "join texts on",
    old: { legacyTextsForNewGroupMembers: true },
    defaults: ON,
    overrides: [],
  },
  {
    name: "push off",
    old: {
      legacyTextsForNewGroupMembers: true,
      legacyPushNotifsForActions: false,
    },
    defaults: { ...ON, pushByDefault: false },
    overrides: [...PUSH_TOGGLES, ...GROUP_NOTICES].map(
      (kind) => `${kind}:push:true`,
    ),
  },
  {
    name: "text off",
    old: {
      legacyTextsForNewGroupMembers: true,
      legacyTextNotifsForActions: false,
    },
    defaults: { ...ON, textByDefault: false },
    overrides: ["group_member_joined:text:true"],
  },
  {
    name: "email off",
    old: {
      legacyTextsForNewGroupMembers: true,
      legacyEmailNotifsForActions: false,
    },
    defaults: { ...ON, emailByDefault: false },
    overrides: [],
  },
  ...(
    [
      ["legacyPushesForActionUpdates", NotificationKind.ActionUpdates],
      ["legacyPushesForComments", NotificationKind.CommentsAndReplies],
      ["legacyPushesForMessages", NotificationKind.Messages],
      ["legacyPushesForLikes", NotificationKind.Likes],
      ["legacyPushesForNewGroupMembers", NotificationKind.GroupMemberJoined],
    ] as const
  ).map(([column, kind]) => ({
    name: `${column} off`,
    old: { legacyTextsForNewGroupMembers: true, [column]: false },
    defaults: ON,
    overrides: [`${kind}:push:false`],
  })),
  {
    name: "pushesForFriendRequests off",
    old: {
      legacyTextsForNewGroupMembers: true,
      legacyPushesForFriendRequests: false,
    },
    defaults: ON,
    overrides: [
      "friend_request_accepted:push:false",
      "friend_requests:push:false",
    ],
  },
  {
    name: "leader reminders off",
    old: {
      legacyTextsForNewGroupMembers: true,
      legacyRemindAboutUncompletedGroupMembers: false,
    },
    defaults: ON,
    overrides: ["email", "push", "text"].map(
      (channel) => `group_members_with_uncompleted_tasks:${channel}:false`,
    ),
  },
  {
    name: "leader reminders off with push off",
    old: {
      legacyTextsForNewGroupMembers: true,
      legacyRemindAboutUncompletedGroupMembers: false,
      legacyPushNotifsForActions: false,
    },
    defaults: { ...ON, pushByDefault: false },
    overrides: [
      ...[...PUSH_TOGGLES, ...GROUP_NOTICES].map((kind) => `${kind}:push:true`),
      "group_members_with_uncompleted_tasks:email:false",
      "group_members_with_uncompleted_tasks:text:false",
    ],
  },
  {
    name: "reply notices off",
    old: {
      legacyTextsForNewGroupMembers: true,
      legacyReceiveReplyNotifications: false,
    },
    defaults: ON,
    overrides: [
      "comments_and_replies:email:false",
      "comments_and_replies:text:false",
    ],
  },
];

describe("NotificationPreferences migration (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([]);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("keeps each member's delivery under the old settings", async () => {
    const userRepo = ctx.dataSource.getRepository(User);
    const users = await Promise.all(
      cases.map((c, i) =>
        userRepo.save(
          userRepo.create({
            email: `migrated-${i}@example.com`,
            password: "pass",
            name: "Pat Member",
            referralSource: ReferralSource.None,
            tags: [ctx.defaultTag],
            ...c.old,
          }),
        ),
      ),
    );

    const migration = new NotificationPreferences1792214215796();
    const runner = ctx.dataSource.createQueryRunner();
    try {
      await migration.down(runner);
      await migration.up(runner);
    } finally {
      await runner.release();
    }

    const preferences = await ctx.dataSource
      .getRepository(NotificationPreference)
      .find();
    const actual = await Promise.all(
      users.map(async (user, i) => {
        const { pushByDefault, textByDefault, emailByDefault } =
          await userRepo.findOneByOrFail({ id: user.id });
        return {
          name: cases[i].name,
          defaults: { pushByDefault, textByDefault, emailByDefault },
          overrides: preferences
            .filter((p) => p.userId === user.id)
            .map((p) => `${p.kind}:${p.channel}:${p.enabled}`)
            .sort(),
        };
      }),
    );
    expect(actual).toEqual(
      cases.map((c) => ({
        name: c.name,
        defaults: c.defaults,
        overrides: [...c.overrides].sort(),
      })),
    );
    expect(
      preferences.every((p) => p.source === PreferenceSource.Migrated),
    ).toBe(true);
  });
});
