import { publicDisplayName } from "@alliance/common/displayName";
import { nameParts } from "src/utils/name-parts";
import { z } from "zod";

/** Chooses how a row's message renders; read from the row, never inferred. */
export enum NotificationFormat {
  Legacy = "legacy",
  Referenced = "referenced",
}

export const rendersFromContent = {
  [NotificationFormat.Legacy]: false,
  [NotificationFormat.Referenced]: true,
} satisfies Record<NotificationFormat, boolean>;

export const FORMATS_RENDERING_FROM_CONTENT = Object.values(
  NotificationFormat,
).filter((format) => rendersFromContent[format]);

export enum UserNameForm {
  Full = "full",
  First = "first",
  Last = "last",
}

export enum SegmentType {
  User = "user",
  Community = "community",
  Action = "action",
  ActionList = "action_list",
  Count = "count",
  Participant = "participant",
}

export enum ActionListStyle {
  Comma = "comma",
  Numbered = "numbered",
}

export const DELETED_MEMBER_LABEL = "Deleted member";
export const DELETED_GROUP_LABEL = "Deleted group";

const id = z.number().int();

const userRefSchema = z.object({
  type: z.literal(SegmentType.User),
  id,
  name: z.enum(UserNameForm),
});
const communityRefSchema = z.object({
  type: z.literal(SegmentType.Community),
  id,
});
const actionRefSchema = z.object({ type: z.literal(SegmentType.Action), id });

type UserRef = z.infer<typeof userRefSchema>;
type CommunityRef = z.infer<typeof communityRefSchema>;

const segmentSchema = z.union([
  z.string(),
  z.discriminatedUnion("type", [
    userRefSchema,
    communityRefSchema,
    actionRefSchema,
    z.object({
      type: z.literal(SegmentType.ActionList),
      ids: z.array(id),
      style: z.enum(ActionListStyle),
    }),
    z.object({ type: z.literal(SegmentType.Count) }),
    z.object({ type: z.literal(SegmentType.Participant) }),
  ]),
]);
type Segment = z.infer<typeof segmentSchema>;

const destinationSchema = z.discriminatedUnion("type", [
  userRefSchema.omit({ name: true }),
  communityRefSchema,
]);
export type Destination = z.infer<typeof destinationSchema>;

/**
 * Reads parse every referenced row with this and throw on a mismatch. A new
 * segment type ships with a new `NotificationFormat`, so code rolled back to
 * before it renders those rows from `message` instead of failing to parse.
 */
const notificationContentSchema = z.object({
  message: z.array(segmentSchema),
  /** Like groups: replaces `message` when the group's count isn't 1. */
  pluralMessage: z.array(segmentSchema).optional(),
  /** The entity the row's location opens; once it's gone, the location is dropped. */
  destination: destinationSchema.optional(),
});
export type NotificationContent = z.infer<typeof notificationContentSchema>;

export function parseNotificationContent(raw: unknown): NotificationContent {
  return notificationContentSchema.parse(raw);
}

export type Labeled = { segment: Segment; label: string };

export type NotifMessage = { segments: Segment[]; text: string };

type NamedUser = { id: number; name: string; anonymous: boolean };

function userLabel(user: NamedUser, form: UserNameForm): string {
  switch (form) {
    case UserNameForm.Full:
      return user.name;
    case UserNameForm.First:
      return nameParts(user.name).firstname;
    case UserNameForm.Last:
      return nameParts(user.name).lastname;
    default:
      throw new Error(`unknown user name form: ${form satisfies never}`);
  }
}

export function member(
  user: NamedUser,
  form: UserNameForm = UserNameForm.Full,
): Labeled & { segment: UserRef } {
  return {
    segment: { type: SegmentType.User, id: user.id, name: form },
    label: userLabel(user, form),
  };
}

export function group(community: {
  id: number;
  name: string;
}): Labeled & { segment: CommunityRef } {
  return {
    segment: { type: SegmentType.Community, id: community.id },
    label: community.name,
  };
}

export function action(entity: { id: number; name: string }): Labeled {
  return {
    segment: { type: SegmentType.Action, id: entity.id },
    label: entity.name,
  };
}

export const userDestination = (userId: number): Destination => ({
  type: SegmentType.User,
  id: userId,
});

export const communityDestination = (communityId: number): Destination => ({
  type: SegmentType.Community,
  id: communityId,
});

/**
 * Interpolated strings become fixed wording; `member`, `group`, and `action`
 * become references whose labels resolve when the row renders.
 */
export function notifMessage(
  strings: TemplateStringsArray,
  ...values: (string | number | Labeled)[]
): NotifMessage {
  const parts: (string | Labeled)[] = [];
  strings.forEach((text, i) => {
    parts.push(text);
    if (i < values.length) {
      const value = values[i];
      parts.push(typeof value === "object" ? value : String(value));
    }
  });
  return joinMessage(parts);
}

export function joinMessage(parts: (string | Labeled)[]): NotifMessage {
  const segments: Segment[] = [];
  let text = "";
  for (const part of parts) {
    if (typeof part === "string") {
      text += part;
      const last = segments.at(-1);
      if (typeof last === "string") {
        segments[segments.length - 1] = last + part;
      } else if (part) {
        segments.push(part);
      }
    } else {
      text += part.label;
      segments.push(part.segment);
    }
  }
  return { segments, text };
}

export type ResolvedReferences = {
  users: ReadonlyMap<number, NamedUser>;
  communities: ReadonlyMap<number, { name: string }>;
  actions: ReadonlyMap<number, { name: string }>;
};

export const NO_REFERENCES: ResolvedReferences = {
  users: new Map(),
  communities: new Map(),
  actions: new Map(),
};

type RenderInput = {
  content: NotificationContent;
  references: ResolvedReferences;
  count: number | null;
  participant?: NamedUser;
};

/**
 * Null when the row can't render because a referenced action is gone.
 */
export function renderNotificationContent(
  input: RenderInput,
): { message: string; destinationAvailable: boolean } | null {
  const { content, references, count } = input;
  const segments =
    content.pluralMessage && count !== 1
      ? content.pluralMessage
      : content.message;

  let message = "";
  for (const segment of segments) {
    const text = renderSegment(segment, input);
    if (text === null) {
      return null;
    }
    message += text;
  }

  return {
    message,
    destinationAvailable: destinationAvailable(content.destination, references),
  };
}

function renderSegment(segment: Segment, input: RenderInput): string | null {
  if (typeof segment === "string") {
    return segment;
  }
  const { references } = input;
  switch (segment.type) {
    case SegmentType.User: {
      const user = references.users.get(segment.id);
      return user ? userLabel(user, segment.name) : DELETED_MEMBER_LABEL;
    }
    case SegmentType.Community:
      return (
        references.communities.get(segment.id)?.name ?? DELETED_GROUP_LABEL
      );
    case SegmentType.Action:
      return references.actions.get(segment.id)?.name ?? null;
    case SegmentType.ActionList: {
      const names = segment.ids.map((id) => references.actions.get(id)?.name);
      if (names.some((name) => name === undefined)) {
        return null;
      }
      return formatActionList(
        names.filter((name) => name !== undefined),
        segment.style,
      );
    }
    case SegmentType.Count:
      return String(input.count ?? 0);
    case SegmentType.Participant:
      return input.participant
        ? publicDisplayName(input.participant)
        : DELETED_MEMBER_LABEL;
    default:
      throw new Error(`unknown segment: ${segment satisfies never}`);
  }
}

export function formatActionList(
  names: string[],
  style: ActionListStyle,
): string {
  switch (style) {
    case ActionListStyle.Comma:
      return names.join(", ");
    case ActionListStyle.Numbered:
      return names.length === 1
        ? names.join(", ")
        : names.map((name, index) => `${index + 1}. ${name}`).join("\n");
    default:
      throw new Error(`unknown action list style: ${style satisfies never}`);
  }
}

function destinationAvailable(
  destination: Destination | undefined,
  references: ResolvedReferences,
): boolean {
  if (!destination) {
    return true;
  }
  switch (destination.type) {
    case SegmentType.User:
      return references.users.has(destination.id);
    case SegmentType.Community:
      return references.communities.has(destination.id);
    default:
      throw new Error(`unknown destination: ${destination satisfies never}`);
  }
}

type ReferenceIds = {
  userIds: Set<number>;
  communityIds: Set<number>;
  actionIds: Set<number>;
};

export function collectReferenceIds(
  contents: NotificationContent[],
): ReferenceIds {
  const ids: ReferenceIds = {
    userIds: new Set(),
    communityIds: new Set(),
    actionIds: new Set(),
  };
  for (const content of contents) {
    for (const segment of [
      ...content.message,
      ...(content.pluralMessage ?? []),
      ...(content.destination ? [content.destination] : []),
    ]) {
      if (typeof segment === "string") continue;
      switch (segment.type) {
        case SegmentType.User:
          ids.userIds.add(segment.id);
          break;
        case SegmentType.Community:
          ids.communityIds.add(segment.id);
          break;
        case SegmentType.Action:
          ids.actionIds.add(segment.id);
          break;
        case SegmentType.ActionList:
          segment.ids.forEach((id) => ids.actionIds.add(id));
          break;
        case SegmentType.Count:
        case SegmentType.Participant:
          break;
        default:
          throw new Error(`unknown segment: ${segment satisfies never}`);
      }
    }
  }
  return ids;
}
