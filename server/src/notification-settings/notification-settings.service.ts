import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { UnreadContent } from "src/notifs/entities/unread-content.entity";
import { NotificationChannel } from "src/notifs/notif-utils";
import { User } from "src/user/entities/user.entity";
import { textReachable } from "src/user/user.utils";
import { DataSource, In, Raw, type EntityManager } from "typeorm";
import type {
  NotificationSettings,
  UpdateNotificationSettingsDto,
} from "./dto/notification-settings.dto";
import {
  KIND_POLICY,
  NotificationKind,
  UNREAD_CONTENT_KIND,
} from "./notification-kind";
import {
  NotificationPreference,
  PreferenceSource,
} from "./notification-preference.entity";
import {
  CHANNEL_DEFAULT_COLUMN,
  NotificationPreferencesService,
  wantsKind,
} from "./notification-preferences.service";

type CellRef = { kind: NotificationKind; channel: NotificationChannel };

export function cellProblems(params: {
  cells: readonly CellRef[];
  isLeader: boolean;
}): string[] {
  const { cells, isLeader } = params;
  const seen = new Set<string>();
  return cells.flatMap(({ kind, channel }) => {
    const key = `${kind}:${channel}`;
    const policy = KIND_POLICY[kind];
    const problem = !policy.channels.includes(channel)
      ? `${kind} isn't offered on ${channel}`
      : policy.required
        ? `${kind} is required and follows the channel defaults`
        : policy.leaderOnly && !isLeader
          ? `${kind} is only for group leaders`
          : seen.has(key)
            ? `${kind} on ${channel} is listed twice`
            : null;
    seen.add(key);
    return problem === null ? [] : [problem];
  });
}

export function settingsFor(params: {
  user: User;
  overrides: readonly NotificationPreference[];
}): NotificationSettings {
  const { user, overrides } = params;
  const override = new Map(
    overrides.map((row) => [`${row.kind}:${row.channel}`, row.enabled]),
  );
  const kinds = Object.values(NotificationKind).filter(
    (kind) => user.isCommunityLeader || !KIND_POLICY[kind].leaderOnly,
  );
  return {
    defaults: user,
    kinds: kinds.map((kind) => {
      const { label, section, required, channels } = KIND_POLICY[kind];
      return {
        kind,
        label,
        section,
        required,
        cells: channels.map((channel) => {
          const set = required ? undefined : override.get(`${kind}:${channel}`);
          return {
            channel,
            override: set ?? null,
            enabled: wantsKind({
              kind,
              channel,
              defaults: user,
              override: set,
            }),
            editable: !required,
          };
        }),
      };
    }),
    reachability: {
      textablePhoneNumber: textReachable({
        phoneNumber: user.phoneNumber,
        phoneNumberUnsubscribed: false,
      }),
      textStopped: user.phoneNumberUnsubscribed,
    },
  };
}

@Injectable()
export class NotificationSettingsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly preferences: NotificationPreferencesService,
  ) {}

  async get(userId: number): Promise<NotificationSettings> {
    const em = this.dataSource.manager;
    const user = await em.findOneByOrFail(User, { id: userId });
    const overrides = await em.findBy(NotificationPreference, { userId });
    return settingsFor({ user, overrides });
  }

  async update(
    userId: number,
    dto: UpdateNotificationSettingsDto,
  ): Promise<NotificationSettings> {
    const cells = dto.cells ?? [];
    const user = await this.dataSource.manager.findOneByOrFail(User, {
      id: userId,
    });
    const problems = cellProblems({ cells, isLeader: user.isCommunityLeader });
    if (problems.length) {
      throw new BadRequestException(problems);
    }
    await this.dataSource.transaction(async (em) => {
      const defaults = Object.fromEntries(
        Object.values(NotificationChannel).flatMap((channel) => {
          const value = dto.defaults?.[defaultsKey[channel]];
          return value === undefined
            ? []
            : [[CHANNEL_DEFAULT_COLUMN[channel], value]];
        }),
      );
      if (Object.keys(defaults).length) {
        await em.update(User, userId, defaults);
      }
      const set = cells.flatMap(({ kind, channel, override }) =>
        override === null
          ? []
          : [
              {
                userId,
                kind,
                channel,
                enabled: override,
                source: PreferenceSource.Member,
              },
            ],
      );
      if (set.length) {
        await em.upsert(NotificationPreference, set, [
          "userId",
          "kind",
          "channel",
        ]);
      }
      for (const { kind, channel } of cells.filter(
        (cell) => cell.override === null,
      )) {
        await em.delete(NotificationPreference, { userId, kind, channel });
      }
      if (
        dto.defaults?.inApp !== undefined ||
        cells.some((cell) => cell.channel === NotificationChannel.InApp)
      ) {
        await this.revisitPendingEntries(em, userId);
      }
    });
    return this.get(userId);
  }

  /** An entry scheduled to arrive later follows the in-app setting it arrives under. */
  private async revisitPendingEntries(em: EntityManager, userId: number) {
    const pending = await em.find(UnreadContent, {
      select: { id: true, contentType: true, visible: true },
      where: {
        user: { id: userId },
        sendTime: Raw((column) => `${column} > now()`),
      },
    });
    if (!pending.length) return;
    const preferences = await this.preferences.load({
      userIds: [userId],
      kinds: pending.map((row) => UNREAD_CONTENT_KIND[row.contentType]),
      em,
    });
    const flipped = pending.flatMap((row) => {
      const visible = preferences.wants({
        userId,
        kind: UNREAD_CONTENT_KIND[row.contentType],
        channel: NotificationChannel.InApp,
      });
      return visible === row.visible ? [] : [{ id: row.id, visible }];
    });
    for (const visible of [true, false]) {
      const ids = flipped
        .filter((row) => row.visible === visible)
        .map((row) => row.id);
      if (ids.length)
        await em.update(UnreadContent, { id: In(ids) }, { visible });
    }
  }
}

const defaultsKey: Record<
  NotificationChannel,
  keyof NonNullable<UpdateNotificationSettingsDto["defaults"]>
> = {
  [NotificationChannel.InApp]: "inApp",
  [NotificationChannel.Push]: "push",
  [NotificationChannel.Text]: "text",
  [NotificationChannel.Email]: "email",
};
