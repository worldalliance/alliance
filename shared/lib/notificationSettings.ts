import { resolveSetting } from "@alliance/common/notificationSetting";
import type {
  ChannelDefaultsDto,
  KindSettingsDto,
  NotificationCellDto,
  NotificationChannel,
  NotificationKind,
  NotificationSection,
  NotificationSettingsDto,
  UpdateChannelDefaultsDto,
  UpdateNotificationCellDto,
  UpdateNotificationSettingsDto,
} from "../client";

export const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  in_app: "In-app",
  push: "Push",
  text: "Text",
  email: "Email",
};

// A Record literal's keys are exactly its key type's members, in written order.
export const CHANNELS = Object.keys(CHANNEL_LABEL) as NotificationChannel[];

const DEFAULT_KEY: Record<NotificationChannel, keyof ChannelDefaultsDto> = {
  in_app: "inApp",
  push: "push",
  text: "text",
  email: "email",
};

export const SECTION_TITLE: Record<NotificationSection, string> = {
  actions: "Actions",
  groups: "Groups",
  forum_and_messages: "Forum & messages",
  friends_and_likes: "Friends & likes",
};

export const SECTIONS = Object.keys(SECTION_TITLE) as NotificationSection[];

export function parseSection(value: string | undefined) {
  return SECTIONS.find((section) => section === value) ?? null;
}

export type SettingChange =
  | { type: "default"; channel: NotificationChannel; value: boolean }
  | {
      type: "cell";
      kind: NotificationKind;
      channel: NotificationChannel;
      /** null follows the channel default */
      value: boolean | null;
    };

export type SettingTarget =
  | { type: "default"; channel: NotificationChannel }
  | { type: "cell"; kind: NotificationKind; channel: NotificationChannel };

export function targetKey(target: SettingTarget): string {
  switch (target.type) {
    case "default":
      return `default:${target.channel}`;
    case "cell":
      return `cell:${target.kind}:${target.channel}`;
    default:
      throw new Error(`unknown target: ${target satisfies never}`);
  }
}

export enum OverrideChoice {
  FollowDefault = "follow_default",
  On = "on",
  Off = "off",
}

export const OVERRIDE_CHOICES = Object.values(OverrideChoice);

export const OVERRIDE_CHOICE_LABEL: Record<OverrideChoice, string> = {
  [OverrideChoice.FollowDefault]: "Follow default",
  [OverrideChoice.On]: "On",
  [OverrideChoice.Off]: "Off",
};

export const OVERRIDE_CHOICE_VALUE: Record<OverrideChoice, boolean | null> = {
  [OverrideChoice.FollowDefault]: null,
  [OverrideChoice.On]: true,
  [OverrideChoice.Off]: false,
};

export const choiceOf = (override: boolean | null): OverrideChoice =>
  override === null
    ? OverrideChoice.FollowDefault
    : override
      ? OverrideChoice.On
      : OverrideChoice.Off;

export const DEFAULTS_HEADING = "Send me notifications by";

export const KINDS_HEADING = "Choose for each notification";

export const defaultLabel = (channel: NotificationChannel) =>
  `${CHANNEL_LABEL[channel]} by default`;

export const kindChannelLabel = (
  kind: KindSettingsDto,
  channel: NotificationChannel,
) => `${kind.label} by ${CHANNEL_LABEL[channel]}`;

export const REQUIRED_KIND_NOTE = "Always follows your defaults";

export const RESET_KIND = "Reset to defaults";

export function defaultOf(
  settings: NotificationSettingsDto,
  channel: NotificationChannel,
): boolean {
  return settings.defaults[DEFAULT_KEY[channel]];
}

/** The settings as they read once `changes` are saved, for showing a choice before the server confirms it. */
export function withChanges(
  settings: NotificationSettingsDto,
  changes: readonly SettingChange[],
): NotificationSettingsDto {
  const defaults = { ...settings.defaults };
  const overrides = new Map<string, boolean | null>();
  for (const change of changes) {
    switch (change.type) {
      case "default":
        defaults[DEFAULT_KEY[change.channel]] = change.value;
        break;
      case "cell":
        overrides.set(targetKey(change), change.value);
        break;
      default:
        throw new Error(`unknown change: ${change satisfies never}`);
    }
  }
  return {
    ...settings,
    defaults,
    kinds: settings.kinds.map((kind) => ({
      ...kind,
      cells: kind.cells.map((cell) => {
        const key = targetKey({
          type: "cell",
          kind: kind.kind,
          channel: cell.channel,
        });
        const override = overrides.has(key)
          ? (overrides.get(key) ?? null)
          : cell.override;
        return {
          ...cell,
          override,
          enabled: resolveSetting({
            required: kind.required,
            override,
            fallback: defaults[DEFAULT_KEY[cell.channel]],
          }),
        };
      }),
    })),
  };
}

export function updateBody(
  changes: readonly SettingChange[],
): UpdateNotificationSettingsDto {
  const defaults: UpdateChannelDefaultsDto = {};
  const cells: UpdateNotificationCellDto[] = [];
  for (const change of changes) {
    switch (change.type) {
      case "default":
        defaults[DEFAULT_KEY[change.channel]] = change.value;
        break;
      case "cell":
        cells.push({
          kind: change.kind,
          channel: change.channel,
          override: change.value,
        });
        break;
      default:
        throw new Error(`unknown change: ${change satisfies never}`);
    }
  }
  return {
    ...(Object.keys(defaults).length ? { defaults } : {}),
    ...(cells.length ? { cells } : {}),
  };
}

export function overrideCount(
  settings: NotificationSettingsDto,
  channel: NotificationChannel,
): number {
  return settings.kinds.filter((kind) =>
    kind.cells.some(
      (cell) => cell.channel === channel && cell.override !== null,
    ),
  ).length;
}

export function overrideCountNote(count: number, channel: NotificationChannel) {
  if (count === 0) return null;
  const label = CHANNEL_LABEL[channel];
  return count === 1
    ? `1 notification has its own setting for ${label}`
    : `${count} notifications have their own setting for ${label}`;
}

export const SETTINGS_LOADING = "Loading notification settings…";

export const sectionTitle = (section: NotificationSection | null) =>
  section ? SECTION_TITLE[section] : "Notifications";

export const UNKNOWN_SECTION = "There's no such group of notifications.";

export const EMPTY_SECTION = "None of these notifications apply to you.";

export const SETTINGS_LOAD_FAILED = "Couldn't load your notification settings.";

export const RECEIVES_NOTHING_WARNING =
  "You will not receive any notifications. Please keep a notification channel enabled if you need reminders to complete actions on time.";

export function receivesNothing(settings: NotificationSettingsDto): boolean {
  return (
    CHANNELS.every((channel) => !defaultOf(settings, channel)) &&
    settings.kinds.every((kind) =>
      kind.cells.every((cell) => cell.override !== true),
    )
  );
}

export function cellStatus(cell: NotificationCellDto): string {
  const value = cell.enabled ? "on" : "off";
  return cell.override === null
    ? `Currently ${value} · from default`
    : `Currently ${value} · your setting`;
}

export function kindSummary(kind: KindSettingsDto): string {
  const on = kind.cells.filter((cell) => cell.enabled);
  return on.length
    ? on.map((cell) => CHANNEL_LABEL[cell.channel]).join(", ")
    : "Off";
}

export function kindsIn(
  settings: NotificationSettingsDto,
  section: NotificationSection,
): KindSettingsDto[] {
  return settings.kinds.filter((kind) => kind.section === section);
}

export function sectionsWithKinds(
  settings: NotificationSettingsDto,
): NotificationSection[] {
  return SECTIONS.filter((section) => kindsIn(settings, section).length);
}

export function resetChanges(kind: KindSettingsDto): SettingChange[] {
  return kind.cells.flatMap((cell) =>
    cell.override === null
      ? []
      : [
          {
            type: "cell" as const,
            kind: kind.kind,
            channel: cell.channel,
            value: null,
          },
        ],
  );
}

export enum TextNotice {
  NoPhoneNumber = "no_phone_number",
  Stopped = "stopped",
}

export function textNotice(
  settings: NotificationSettingsDto,
): TextNotice | null {
  const { textablePhoneNumber, textStopped } = settings.reachability;
  return !textablePhoneNumber
    ? TextNotice.NoPhoneNumber
    : textStopped
      ? TextNotice.Stopped
      : null;
}

export const TEXT_NOTICE_COPY: Record<TextNotice, string> = {
  [TextNotice.NoPhoneNumber]:
    "Add a valid phone number to your profile to get texts.",
  [TextNotice.Stopped]:
    "You replied STOP to our texts. Reply START to get them again.",
};
