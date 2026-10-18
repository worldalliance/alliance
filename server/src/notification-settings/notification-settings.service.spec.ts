import { NotificationChannel } from "src/notifs/notif-utils";
import { User } from "src/user/entities/user.entity";
import { NotificationKind } from "./notification-kind";
import {
  NotificationPreference,
  PreferenceSource,
} from "./notification-preference.entity";
import { cellProblems, settingsFor } from "./notification-settings.service";

describe("cellProblems", () => {
  it("accepts offered cells of optional kinds", () => {
    expect(
      cellProblems({
        cells: [
          { kind: NotificationKind.Likes, channel: NotificationChannel.Push },
          { kind: NotificationKind.Likes, channel: NotificationChannel.InApp },
        ],
        isLeader: false,
      }),
    ).toEqual([]);
  });

  it("accepts a leader-only kind only from a leader", () => {
    const cells = [
      {
        kind: NotificationKind.MemberLeftCommunity,
        channel: NotificationChannel.Push,
      },
    ];
    expect(cellProblems({ cells, isLeader: true })).toEqual([]);
    expect(cellProblems({ cells, isLeader: false })).toHaveLength(1);
  });

  it("rejects a required kind, an unoffered channel, and a repeated cell", () => {
    expect(
      cellProblems({
        cells: [
          {
            kind: NotificationKind.ContractSuspended,
            channel: NotificationChannel.Push,
          },
          { kind: NotificationKind.Likes, channel: NotificationChannel.Text },
          { kind: NotificationKind.Likes, channel: NotificationChannel.Push },
          { kind: NotificationKind.Likes, channel: NotificationChannel.Push },
        ],
        isLeader: true,
      }),
    ).toEqual([
      "contract_suspended is required and follows the channel defaults",
      "likes isn't offered on text",
      "likes on push is listed twice",
    ]);
  });
});

describe("settingsFor", () => {
  const member = (leaderOfIds: number[]) =>
    Object.assign(new User(), {
      leaderOfIds,
      inAppByDefault: true,
      pushByDefault: false,
      textByDefault: true,
      emailByDefault: true,
      phoneNumber: "+14155552671",
      phoneNumberUnsubscribed: true,
    });
  const override = (
    kind: NotificationKind,
    channel: NotificationChannel,
    enabled: boolean,
  ) =>
    Object.assign(new NotificationPreference(), {
      userId: 1,
      kind,
      channel,
      enabled,
      source: PreferenceSource.Member,
    });

  it("resolves each cell from its override or the channel default", () => {
    const settings = settingsFor({
      user: member([]),
      overrides: [
        override(NotificationKind.Likes, NotificationChannel.Push, true),
      ],
    });
    const likes = settings.kinds.find(
      (kind) => kind.kind === NotificationKind.Likes,
    );
    expect(likes?.cells).toEqual([
      {
        channel: NotificationChannel.InApp,
        override: null,
        enabled: true,
        editable: true,
      },
      {
        channel: NotificationChannel.Push,
        override: true,
        enabled: true,
        editable: true,
      },
    ]);
  });

  it("locks a required kind to the defaults and ignores a stored override", () => {
    const settings = settingsFor({
      user: member([]),
      overrides: [
        override(
          NotificationKind.ContractSuspended,
          NotificationChannel.Push,
          true,
        ),
      ],
    });
    const suspended = settings.kinds.find(
      (kind) => kind.kind === NotificationKind.ContractSuspended,
    );
    expect(suspended?.cells[0]).toEqual({
      channel: NotificationChannel.Push,
      override: null,
      enabled: false,
      editable: false,
    });
  });

  it("shows leader-only kinds only to leaders", () => {
    const kindsFor = (leaderOfIds: number[]) =>
      settingsFor({ user: member(leaderOfIds), overrides: [] }).kinds.map(
        (kind) => kind.kind,
      );
    expect(kindsFor([])).not.toContain(NotificationKind.MemberLeftCommunity);
    expect(kindsFor([7])).toContain(NotificationKind.MemberLeftCommunity);
  });

  it("reports a number that replied STOP apart from the setting", () => {
    expect(
      settingsFor({ user: member([]), overrides: [] }).reachability,
    ).toEqual({ textablePhoneNumber: true, textStopped: true });
  });
});
