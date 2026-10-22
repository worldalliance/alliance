import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { chunk } from "es-toolkit";
import { actionUpdateEntrySendTime } from "src/actions/action-update-visibility";
import { ActionUpdate } from "src/actions/entities/action-update.entity";
import { Comment } from "src/forum/entities/comment.entity";
import { MessageTrackingService } from "src/link-tracking/message-tracking.service";
import { MailService } from "src/mail/mail.service";
import { MmsService } from "src/mms/mms.service";
import {
  CATEGORY_KIND,
  NotificationKind,
  UNREAD_CONTENT_KIND,
} from "src/notification-settings/notification-kind";
import { NotificationPreferencesService } from "src/notification-settings/notification-preferences.service";
import { User } from "src/user/entities/user.entity";
import type {
  Repository as TypedRepository,
  WithRelations,
} from "src/utils/Repository";
import { DeepPartial, EntityManager, In, IsNull, Raw } from "typeorm";
import { NotifClickDto } from "./dto/notifclick.dto";
import { NotificationDto } from "./dto/notification.dto";
import { ActionEventNotif } from "./entities/action-event-notif.entity";
import {
  Notification,
  NOTIFICATION_CATEGORY_PRIORITIES,
} from "./entities/notification.entity";
import {
  UnreadContent,
  UnreadContentType,
} from "./entities/unread-content.entity";
import { NotificationChannel } from "./notif-utils";
import {
  actionCommentContent,
  type ContentTarget,
  type Destination,
  FORMATS_RENDERING_FROM_CONTENT,
  forumReplyContent,
  LIVE_ACTION_UPDATE_TEXT,
  type NotificationContent,
  NotificationFormat,
  type NotifMessage,
} from "./notification-content";
import {
  followsLiveActionUpdateText,
  NotificationRenderService,
} from "./notification-render.service";

export type CreateNotifParams = Required<
  Pick<
    DeepPartial<Notification>,
    "user" | "category" | "webAppLocation" | "associatedUsers"
  >
> &
  Omit<DeepPartial<Notification>, "message" | "format" | "content"> & {
    message: NotifMessage;
    /** Null when the location doesn't open a member or group. */
    destination: Destination | null;
    pluralMessage?: NotifMessage;
    target?: ContentTarget;
  };

type UnreadContentSource =
  | {
      contentType: UnreadContentType.ForumReply;
      authorId: number;
      /** Set when the recipient authored the action or a post linked to it, so the copy names the action. */
      actionId?: number;
    }
  | {
      contentType: UnreadContentType.ActionUpdate;
      /** Unset to follow the update's live text. */
      fixedText?: string;
    };

export type CreateUnreadContentParams = Required<
  Pick<DeepPartial<UnreadContent>, "user" | "contentId">
> &
  Omit<DeepPartial<UnreadContent>, "format" | "content" | "contentType"> &
  UnreadContentSource;

function unreadContentFor(source: UnreadContentSource): NotificationContent {
  switch (source.contentType) {
    case UnreadContentType.ForumReply:
      return source.actionId === undefined
        ? forumReplyContent(source.authorId)
        : actionCommentContent({
            authorId: source.authorId,
            actionId: source.actionId,
          });
    case UnreadContentType.ActionUpdate:
      return source.fixedText === undefined
        ? LIVE_ACTION_UPDATE_TEXT
        : { message: [source.fixedText] };
    default:
      throw new Error(
        `unknown unread content source: ${source satisfies never}`,
      );
  }
}

// TypeORM bulk-inserts a saved array as one statement, and Postgres caps a
// statement at 65535 bind parameters. `UnreadContent` writes ~13 columns per
// row, so an unchunked "notify all members" send would start failing outright
// somewhere around 5k recipients.
const UNREAD_CONTENT_INSERT_CHUNK = 1000;

export type UnreadContentWithUser = WithRelations<
  UnreadContent,
  { user: true }
>;
export type NotificationWithUser = WithRelations<Notification, { user: true }>;

const byRecipient = <T extends { user: User }>(rows: T[]) =>
  Map.groupBy(rows, (row) => row.user.id);

function recipientId(user: DeepPartial<User>): number {
  if (user.id === undefined) {
    throw new Error("a notification needs its recipient's id");
  }
  return user.id;
}

@Injectable()
export class NotifsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifsRepository: TypedRepository<Notification>,
    @InjectRepository(UnreadContent)
    private readonly unreadContentRepository: TypedRepository<UnreadContent>,
    @InjectRepository(ActionEventNotif)
    private readonly actionEventNotifsRepository: TypedRepository<ActionEventNotif>,
    private readonly mailService: MailService,
    private readonly mmsService: MmsService,
    private readonly renderService: NotificationRenderService,
    private readonly messageTracking: MessageTrackingService,
    private readonly preferences: NotificationPreferencesService,
  ) {}

  findOne(id: number) {
    return this.notifsRepository.findOne({
      where: { id },
    });
  }

  async notifsForUser(id: number) {
    return this.actionEventNotifsRepository.find({
      where: { user: { id } },
      relations: {
        user: true,
        mail: true,
        mms: true,
        pushes: true,
      },
    });
  }

  async notifLinkClick(body: NotifClickDto): Promise<boolean> {
    const notif = await this.notifsRepository.findOne({
      where: { cid: body.cid },
    });
    const notificationId =
      notif?.id ?? (await this.messageTracking.notificationIdFor(body.cid));
    if (notificationId !== null) {
      await this.notifsRepository.update(notificationId, {
        readAt: new Date(),
      });
    }

    const mms = await this.mmsService.setClickedLinkByCid(body.cid);
    if (mms) {
      return true;
    }
    await this.mailService.setClickedLinkByCid(body.cid);

    return false;
  }

  /**
   * Takes the whole audience at once so the caller can send it in the same
   * transaction as its own once-only guard.
   */
  async createActionUpdateNotifs(params: {
    actionUpdate: ActionUpdate;
    users: User[];
    em?: EntityManager;
  }) {
    const { actionUpdate, users, em } = params;
    const sendTime = actionUpdateEntrySendTime(actionUpdate);
    return this.sendUnreadContents(
      users.map((user) => ({
        user,
        contentType: UnreadContentType.ActionUpdate,
        contentId: actionUpdate.id,
        sendTime,
      })),
      em,
    );
  }

  /**
   * Moves an update's entries that aren't due yet to `until`, so entries kept
   * back while it is unpublished arrive, and push, when it shows. Entries
   * already due were delivered and stay put.
   */
  async deferActionUpdateEntries(params: {
    actionUpdateId: number;
    until: Date;
    em: EntityManager;
  }) {
    const { actionUpdateId, until, em } = params;
    await em.update(
      UnreadContent,
      {
        contentType: UnreadContentType.ActionUpdate,
        contentId: actionUpdateId,
        pushClaimedBy: IsNull(),
        sendTime: Raw(
          (sendTime) => `${sendTime} > now() AND ${sendTime} < :until`,
          {
            until,
          },
        ),
      },
      { sendTime: until },
    );
  }

  /**
   * Renders the update's due entries that still follow its text, which keeps
   * that text in every one its recipient can see. Call before members stop
   * seeing the text: before an edit replaces it or unpublishing hides it. It
   * takes its own pool connections, so call it outside a transaction. An entry
   * that never rendered and that its recipient can't see right now keeps
   * following edits.
   */
  async freezeActionUpdateCopy(actionUpdateId: number) {
    const due = await this.unreadContentRepository.find({
      where: {
        contentType: UnreadContentType.ActionUpdate,
        contentId: actionUpdateId,
        format: In(FORMATS_RENDERING_FROM_CONTENT),
        sendTime: Raw((sendTime) => `${sendTime} <= clock_timestamp()`),
        content: followsLiveActionUpdateText(),
      },
      relations: { user: true },
      select: {
        id: true,
        format: true,
        content: true,
        contentType: true,
        contentId: true,
        readAt: true,
        createdAt: true,
        sendTime: true,
        user: { id: true },
      },
    });
    for (const rows of chunk(due, UNREAD_CONTENT_INSERT_CHUNK)) {
      await this.renderService.renderUnreadContents(byRecipient(rows));
    }
  }

  async createForumReplyNotif(comment: Comment, user: User) {
    return this.sendUnreadContent({
      user,
      contentType: UnreadContentType.ForumReply,
      contentId: comment.id,
      sendTime: comment.createdAt,
      authorId: comment.authorId,
    });
  }

  async createNotif(notif: CreateNotifParams) {
    return (await this.createNotifs([notif]))[0];
  }

  async createNotifs(notifs: CreateNotifParams[]) {
    const inInbox = await this.inInbox(
      notifs.map(({ user, category }) => ({
        userId: recipientId(user),
        kind: CATEGORY_KIND[category],
      })),
    );
    return notifs.map((notif, index) => this.buildNotif(notif, inInbox[index]));
  }

  buildNotif(
    {
      message,
      destination,
      pluralMessage,
      target,
      ...notif
    }: CreateNotifParams,
    visible: boolean,
  ) {
    return this.notifsRepository.create({
      ...notif,
      visible,
      priority:
        notif.priority ?? NOTIFICATION_CATEGORY_PRIORITIES[notif.category],
      format: NotificationFormat.Referenced,
      message: message.text,
      content: {
        message: message.segments,
        ...(pluralMessage && { pluralMessage: pluralMessage.segments }),
        ...(destination && { destination }),
        ...(target && { target }),
      } satisfies NotificationContent,
    });
  }

  async sendNotif(notif: CreateNotifParams) {
    return this.notifsRepository.save(await this.createNotif(notif));
  }

  async sendNotifs(notifs: CreateNotifParams[]) {
    return this.notifsRepository.save(await this.createNotifs(notifs));
  }

  /** Each recipient's in-app setting for a row's kind, in order. */
  async inInbox(
    rows: { userId: number; kind: NotificationKind }[],
    em?: EntityManager,
  ): Promise<boolean[]> {
    const preferences = await this.preferences.load({
      userIds: rows.map((row) => row.userId),
      kinds: rows.map((row) => row.kind),
      em,
    });
    return rows.map((row) =>
      preferences.wants({ ...row, channel: NotificationChannel.InApp }),
    );
  }

  async hasNotifWithGroupingKey(
    userId: number,
    groupingKey: string,
  ): Promise<boolean> {
    return (
      (await this.notifsRepository.count({
        where: { user: { id: userId }, groupingKey },
      })) > 0
    );
  }

  private buildUnreadContent(
    unreadContent: CreateUnreadContentParams,
    visible: boolean,
  ) {
    return this.unreadContentRepository.create({
      ...unreadContent,
      visible,
      format: NotificationFormat.Referenced,
      content: unreadContentFor(unreadContent),
      sendTime: unreadContent.sendTime ?? new Date(),
    });
  }

  async sendUnreadContent(unreadContent: CreateUnreadContentParams) {
    return (await this.sendUnreadContents([unreadContent]))[0];
  }

  async sendUnreadContents(
    unreadContents: CreateUnreadContentParams[],
    em?: EntityManager,
  ) {
    const manager = em ?? this.unreadContentRepository.manager;
    const inInbox = await this.inInbox(
      unreadContents.map(({ user, contentType }) => ({
        userId: recipientId(user),
        kind: UNREAD_CONTENT_KIND[contentType],
      })),
      em,
    );
    return manager.save(
      UnreadContent,
      unreadContents.map((content, index) =>
        this.buildUnreadContent(content, inInbox[index]),
      ),
      { chunk: UNREAD_CONTENT_INSERT_CHUNK },
    );
  }

  async getUnreadContentsForPush(ids: number[]) {
    const unreadContents: UnreadContentWithUser[] =
      await this.unreadContentRepository.find({
        where: { id: In(ids) },
        relations: { user: true },
        order: { sendTime: "ASC" },
      });

    const dtos = await this.renderService.renderUnreadContents(
      byRecipient(unreadContents),
    );
    const dtoById = new Map(dtos.map((dto) => [dto.id, dto]));

    return unreadContents.flatMap((unreadContent) => {
      const dto = dtoById.get(unreadContent.id);
      return dto ? [{ unreadContent, dto }] : [];
    });
  }

  async renderNotificationsForPush(
    notifs: NotificationWithUser[],
  ): Promise<Map<number, NotificationDto>> {
    const dtos = await this.renderService.renderNotifications(
      byRecipient(notifs),
    );
    return new Map(dtos.map((dto) => [dto.id, dto]));
  }
}
