import { Community } from "src/community/entities/community.entity";
import { NotificationKind } from "src/notification-settings/notification-kind";
import {
  NotificationPreference,
  PreferenceSource,
} from "src/notification-settings/notification-preference.entity";
import {
  UnreadContent,
  UnreadContentType,
} from "src/notifs/entities/unread-content.entity";
import { NotificationChannel } from "src/notifs/notif-utils";
import { User } from "src/user/entities/user.entity";
import request from "supertest";
import { In, type Repository } from "typeorm";
import { createTestApp, signAccessToken, TestContext } from "./e2e-test-utils";

type Cell = {
  channel: NotificationChannel;
  override: boolean | null;
  enabled: boolean;
  editable: boolean;
};
type KindSettings = {
  kind: NotificationKind;
  example: string;
  cells: Cell[];
};

describe("Notification settings (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let preferenceRepo: Repository<NotificationPreference>;
  let member: User;
  let token: string;
  let users = 0;

  const createMember = () =>
    userRepo.save(
      userRepo.create({
        email: `settings-${++users}@example.com`,
        password: "pass",
        name: "Settings Member",
      }),
    );

  const get = (as = token) =>
    request(ctx.app.getHttpServer())
      .get("/user/notification-settings")
      .set("Authorization", `Bearer ${as}`);

  const patch = (body: object) =>
    request(ctx.app.getHttpServer())
      .patch("/user/notification-settings")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const cell = (
    kinds: KindSettings[],
    kind: NotificationKind,
    channel: NotificationChannel,
  ) =>
    kinds
      .find((settings) => settings.kind === kind)
      ?.cells.find((settings) => settings.channel === channel);

  beforeAll(async () => {
    ctx = await createTestApp([]);
    userRepo = ctx.dataSource.getRepository(User);
    preferenceRepo = ctx.dataSource.getRepository(NotificationPreference);
  }, 50000);

  beforeEach(async () => {
    member = await createMember();
    token = signAccessToken(ctx.jwtService, member);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("starts a new account with every default on and no overrides", async () => {
    const res = await get().expect(200);

    expect(res.body.defaults).toEqual({
      inApp: true,
      push: true,
      text: true,
      email: true,
    });
    expect(
      (res.body.kinds as KindSettings[]).flatMap((kind) =>
        kind.cells.filter((settings) => settings.override !== null),
      ),
    ).toEqual([]);
    expect(res.body.reachability).toEqual({
      textablePhoneNumber: false,
      textStopped: false,
    });
    expect(
      (res.body.kinds as KindSettings[]).find(
        (kind) => kind.kind === NotificationKind.FriendRequests,
      )?.example,
    ).toBe("Jordan Ellis wants to be friends");
  });

  it("hides leader-only kinds from members who lead no group", async () => {
    const kindsOf = async (as: string) =>
      ((await get(as).expect(200)).body.kinds as KindSettings[]).map(
        (kind) => kind.kind,
      );
    const leader = await createMember();
    await ctx.dataSource
      .getRepository(Community)
      .save({ name: "Led group", leaders: [leader], users: [leader] });

    expect(await kindsOf(token)).not.toContain(
      NotificationKind.MemberLeftCommunity,
    );
    expect(await kindsOf(signAccessToken(ctx.jwtService, leader))).toContain(
      NotificationKind.MemberLeftCommunity,
    );
  });

  it("saves a leader-only kind for a group leader", async () => {
    await ctx.dataSource
      .getRepository(Community)
      .save({ name: "Saved group", leaders: [member], users: [member] });

    const saved = await patch({
      cells: [
        {
          kind: NotificationKind.MemberLeftCommunity,
          channel: NotificationChannel.Push,
          override: false,
        },
      ],
    }).expect(200);

    expect(
      cell(
        saved.body.kinds,
        NotificationKind.MemberLeftCommunity,
        NotificationChannel.Push,
      ),
    ).toMatchObject({ override: false, enabled: false });
  });

  it("saves defaults and overrides, and clears an override with null", async () => {
    const saved = await patch({
      defaults: { push: false },
      cells: [
        {
          kind: NotificationKind.Likes,
          channel: NotificationChannel.Push,
          override: true,
        },
        {
          kind: NotificationKind.Messages,
          channel: NotificationChannel.Push,
          override: false,
        },
      ],
    }).expect(200);

    expect(saved.body.defaults.push).toBe(false);
    expect(
      cell(saved.body.kinds, NotificationKind.Likes, NotificationChannel.Push),
    ).toEqual({
      channel: NotificationChannel.Push,
      override: true,
      enabled: true,
      editable: true,
    });
    expect(
      cell(
        saved.body.kinds,
        NotificationKind.FriendRequests,
        NotificationChannel.Push,
      )?.enabled,
    ).toBe(false);
    expect(await preferenceRepo.findBy({ userId: member.id })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: NotificationKind.Likes,
          enabled: true,
          source: PreferenceSource.Member,
        }),
      ]),
    );

    const cleared = await patch({
      cells: [
        {
          kind: NotificationKind.Likes,
          channel: NotificationChannel.Push,
          override: null,
        },
      ],
    }).expect(200);

    expect(
      cell(
        cleared.body.kinds,
        NotificationKind.Likes,
        NotificationChannel.Push,
      ),
    ).toMatchObject({ override: null, enabled: false });
    expect(
      (await preferenceRepo.findBy({ userId: member.id })).map(
        (row) => row.kind,
      ),
    ).toEqual([NotificationKind.Messages]);
  });

  it.each([
    [
      "a required kind",
      {
        kind: NotificationKind.ContractSuspended,
        channel: NotificationChannel.Push,
        override: false,
      },
    ],
    [
      "a channel the kind doesn't offer",
      {
        kind: NotificationKind.Likes,
        channel: NotificationChannel.Text,
        override: true,
      },
    ],
    [
      "a missing override",
      { kind: NotificationKind.Likes, channel: NotificationChannel.Push },
    ],
    [
      "an unknown kind",
      { kind: "nope", channel: NotificationChannel.Push, override: true },
    ],
    [
      "a leader-only kind from a member who leads no group",
      {
        kind: NotificationKind.MemberLeftCommunity,
        channel: NotificationChannel.Push,
        override: false,
      },
    ],
  ])("rejects an override on %s and saves nothing", async (_, rejected) => {
    await patch({
      defaults: { email: false },
      cells: [
        {
          kind: NotificationKind.Likes,
          channel: NotificationChannel.InApp,
          override: false,
        },
        rejected,
      ],
    }).expect(400);

    expect(await preferenceRepo.findBy({ userId: member.id })).toEqual([]);
    expect(
      (await userRepo.findOneByOrFail({ id: member.id })).emailByDefault,
    ).toBe(true);
  });

  it.each([
    ["a null default", { defaults: { email: false, push: null } }],
    ["null defaults", { defaults: null, cells: [] }],
    ["array defaults", { defaults: [] }],
    ["null cells", { defaults: { email: false }, cells: null }],
  ])("rejects %s and saves nothing", async (_, body) => {
    await patch(body).expect(400);

    expect(
      (await userRepo.findOneByOrFail({ id: member.id })).emailByDefault,
    ).toBe(true);
  });

  it("shows or hides an entry not yet arrived by the in-app setting it arrives under", async () => {
    const contentRepo = ctx.dataSource.getRepository(UnreadContent);
    const entry = (sendTime: Date) =>
      contentRepo.save(
        contentRepo.create({
          user: { id: member.id },
          contentType: UnreadContentType.ActionUpdate,
          contentId: 1,
          sendTime,
        }),
      );
    const arrived = await entry(new Date(Date.now() - 60_000));
    const pending = await entry(new Date(Date.now() + 60_000));
    const visibility = async () =>
      (
        await contentRepo.find({
          where: { id: In([arrived.id, pending.id]) },
          order: { id: "ASC" },
        })
      ).map((row) => row.visible);
    const setActionUpdatesInApp = (override: boolean | null) =>
      patch({
        cells: [
          {
            kind: NotificationKind.ActionUpdates,
            channel: NotificationChannel.InApp,
            override,
          },
        ],
      }).expect(200);

    await setActionUpdatesInApp(false);
    expect(await visibility()).toEqual([true, false]);

    await setActionUpdatesInApp(null);
    expect(await visibility()).toEqual([true, true]);

    await patch({ defaults: { inApp: false } }).expect(200);
    expect(await visibility()).toEqual([true, false]);
  });

  describe("admin view", () => {
    const getAdmin = (userId: number, as = ctx.adminAccessToken) =>
      request(ctx.app.getHttpServer())
        .get(`/user/userdetail/${userId}/notification-settings`)
        .set("Authorization", `Bearer ${as}`);

    it("shows a member's defaults and every stored override with its source", async () => {
      await userRepo.update(member.id, { textByDefault: false });
      await preferenceRepo.save([
        {
          userId: member.id,
          kind: NotificationKind.Likes,
          channel: NotificationChannel.Push,
          enabled: false,
          source: PreferenceSource.Member,
        },
        {
          userId: member.id,
          kind: NotificationKind.MemberLeftCommunity,
          channel: NotificationChannel.Push,
          enabled: true,
          source: PreferenceSource.Migrated,
        },
      ]);

      const res = await getAdmin(member.id).expect(200);

      expect(res.body.defaults).toEqual({
        inApp: true,
        push: true,
        text: false,
        email: true,
      });
      expect(res.body.overrides).toEqual([
        {
          kind: NotificationKind.Likes,
          label: "Likes",
          channel: NotificationChannel.Push,
          enabled: false,
          source: PreferenceSource.Member,
          inEffect: true,
        },
        expect.objectContaining({
          kind: NotificationKind.MemberLeftCommunity,
          enabled: true,
          source: PreferenceSource.Migrated,
          inEffect: false,
        }),
      ]);
    });

    it("says a member that does not exist was not found", async () => {
      await getAdmin(0).expect(404);
    });

    it("refuses a member who isn't an admin", async () => {
      await getAdmin(member.id, token).expect(401);
    });
  });

  it("requires a session", async () => {
    await request(ctx.app.getHttpServer())
      .get("/user/notification-settings")
      .expect(401);
  });
});
