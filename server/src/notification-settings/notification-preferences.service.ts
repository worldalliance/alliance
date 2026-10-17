import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { NotificationChannel } from "src/notifs/notif-utils";
import { User } from "src/user/entities/user.entity";
import { DataSource, In, Raw, type EntityManager } from "typeorm";
import { externalChannels, type ExternalRecipient } from "./external-channels";
import { KIND_POLICY, NotificationKind } from "./notification-kind";
import { NotificationPreference } from "./notification-preference.entity";

type ChannelDefaults = Pick<
  User,
  "inAppByDefault" | "pushByDefault" | "textByDefault" | "emailByDefault"
>;

const DEFAULT_COLUMN: Record<NotificationChannel, keyof ChannelDefaults> = {
  [NotificationChannel.InApp]: "inAppByDefault",
  [NotificationChannel.Push]: "pushByDefault",
  [NotificationChannel.Text]: "textByDefault",
  [NotificationChannel.Email]: "emailByDefault",
};

/** Whether a member wants a kind on a channel; who can be reached is the sender's check. */
export function wantsKind(params: {
  kind: NotificationKind;
  channel: NotificationChannel;
  defaults: ChannelDefaults;
  override: boolean | undefined;
}): boolean {
  const { kind, channel, defaults, override } = params;
  const policy = KIND_POLICY[kind];
  if (!policy.channels.includes(channel)) return false;
  const fallback = defaults[DEFAULT_COLUMN[channel]];
  return policy.required ? fallback : (override ?? fallback);
}

type Cell = Pick<NotificationPreference, "userId" | "kind" | "channel">;

const overrideKey = ({ userId, kind, channel }: Cell) =>
  `${userId}:${kind}:${channel}`;

export class Preferences {
  constructor(
    private readonly defaults: ReadonlyMap<number, ChannelDefaults>,
    private readonly overrides: ReadonlyMap<string, boolean>,
  ) {}

  /** False for a member who isn't loaded, such as a deleted account. */
  wants(cell: Cell): boolean {
    const { userId, kind, channel } = cell;
    const defaults = this.defaults.get(userId);
    return (
      defaults !== undefined &&
      wantsKind({
        kind,
        channel,
        defaults,
        override: this.overrides.get(overrideKey(cell)),
      })
    );
  }
}

@Injectable()
export class NotificationPreferencesService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async load(params: {
    userIds: readonly number[];
    kinds: readonly NotificationKind[];
    em?: EntityManager;
  }): Promise<Preferences> {
    const { userIds, kinds } = params;
    const em = params.em ?? this.dataSource.manager;
    if (!userIds.length) return new Preferences(new Map(), new Map());
    const ids = Raw((column) => `${column} = ANY(:ids)`, {
      ids: [...new Set(userIds)],
    });
    const users = await em.find(User, {
      where: { id: ids },
      select: {
        id: true,
        inAppByDefault: true,
        pushByDefault: true,
        textByDefault: true,
        emailByDefault: true,
      },
    });
    const overrides = await em.find(NotificationPreference, {
      where: { userId: ids, kind: In([...new Set(kinds)]) },
    });
    return new Preferences(
      new Map(users.map((user) => [user.id, user])),
      new Map(overrides.map((row) => [overrideKey(row), row.enabled])),
    );
  }

  async channelsFor(
    user: ExternalRecipient,
    kind: NotificationKind,
  ): Promise<NotificationChannel[]> {
    return externalChannels({
      user,
      kind,
      preferences: await this.load({ userIds: [user.id], kinds: [kind] }),
    });
  }
}
