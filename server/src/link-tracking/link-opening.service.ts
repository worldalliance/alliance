import { AnalyticsEvent } from "@alliance/common/analytics";
import {
  LINK_OPENING_DEADLINE_MS,
  normalizeDestination,
} from "@alliance/common/linkOpening";
import { R, type Result } from "@alliance/common/result";
import { Injectable } from "@nestjs/common";
import { milliseconds } from "date-fns";
import { lockLive } from "src/datasources/soft-delete";
import { Mail } from "src/mail/mail.entity";
import { Mms } from "src/mms/mms.entity";
import { Notification } from "src/notifs/entities/notification.entity";
import { PosthogService } from "src/posthog/posthog.service";
import { User } from "src/user/entities/user.entity";
import { DataSource, type EntityManager, IsNull } from "typeorm";
import type { RecordLinkOpeningDto } from "./dto/link-opening.dto";
import { legacyOwner } from "./legacy-link-owner";
import { LinkOpening } from "./link-opening.entity";
import {
  MessageChannel,
  type MessageContext,
  messageContextSchema,
  MessageTracking,
} from "./message-tracking.entity";

export enum LinkOpeningRejection {
  Invalid = "invalid",
  /**
   * No such message, or the recipient of a tracked link has been deleted. A
   * legacy link whose recipient was deleted is recorded unattributed.
   */
  Unknown = "unknown",
}

/** The ID format of links sent before tracking. */
const LEGACY_CID = /^[0-9a-f]{10}$/;

const CLOCK_SKEW_MS = milliseconds({ hours: 1 });

/**
 * The `platform` the browser reported before the server sent this event; for
 * a legacy ID an email and a text shared, it reported mms.
 */
const POSTHOG_PLATFORM: Record<MessageChannel, string> = {
  [MessageChannel.Email]: "email",
  [MessageChannel.Sms]: "mms",
  [MessageChannel.Unknown]: "mms",
};

enum InsertKind {
  Recorded = "recorded",
  Repeated = "repeated",
  /**
   * A legacy link with no recoverable recipient, whose opening is stored
   * without attribution; only a sole message carrying it is marked clicked.
   */
  Unattributed = "unattributed",
  Unknown = "unknown",
}

type Recorded = {
  tracking: MessageTracking;
  context: MessageContext;
  opening: LinkOpening;
};

type Ownerless = { platform: string };

type Insertion =
  | ({ kind: InsertKind.Recorded } & Recorded)
  | ({ kind: InsertKind.Unattributed; opening: LinkOpening } & Ownerless)
  | { kind: InsertKind.Repeated | InsertKind.Unknown };

@Injectable()
export class LinkOpeningService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly posthog: PosthogService,
  ) {}

  /** Succeeds for an opening already recorded, which records nothing more. */
  async record(params: {
    dto: RecordLinkOpeningDto;
    now: Date;
  }): Promise<Result<void, LinkOpeningRejection>> {
    const { dto, now } = params;
    const { observedAt } = dto;
    if (
      observedAt.getTime() > now.getTime() + CLOCK_SKEW_MS ||
      observedAt.getTime() <
        now.getTime() - LINK_OPENING_DEADLINE_MS - CLOCK_SKEW_MS
    ) {
      return R.failure(LinkOpeningRejection.Invalid);
    }

    const insertion = await this.dataSource.transaction((manager) =>
      this.insert({
        manager,
        dto,
        // Normalized here rather than checked, so an older client's
        // normalization still records its opening.
        destination: normalizeDestination(dto.destination),
        now,
      }),
    );
    switch (insertion.kind) {
      case InsertKind.Recorded:
        this.capture(insertion);
        return R.success(undefined);
      case InsertKind.Unattributed:
        this.captureOwnerless({
          cid: dto.trackingId,
          platform: insertion.platform,
          opening: insertion.opening,
        });
        return R.success(undefined);
      case InsertKind.Repeated:
        return R.success(undefined);
      case InsertKind.Unknown:
        return R.failure(LinkOpeningRejection.Unknown);
      default:
        throw new Error(`unknown insertion: ${insertion satisfies never}`);
    }
  }

  private async insert(params: {
    manager: EntityManager;
    dto: RecordLinkOpeningDto;
    destination: string;
    now: Date;
  }): Promise<Insertion> {
    const { manager, dto, destination, now } = params;
    const tracking =
      (await manager.findOne(MessageTracking, {
        where: { trackingId: dto.trackingId },
        relations: { actionEventNotif: true },
      })) ?? (await this.recoverLegacy({ manager, cid: dto.trackingId, now }));
    if (tracking === InsertKind.Unknown) return { kind: tracking };
    const attributed = tracking instanceof MessageTracking;
    if (
      attributed &&
      !(await lockLive(manager, [{ target: MessageTracking, id: tracking.id }]))
    ) {
      return { kind: InsertKind.Unknown };
    }

    const inserted = await manager
      .createQueryBuilder()
      .insert()
      .into(LinkOpening)
      .values({
        openingId: dto.openingId,
        messageTrackingId: attributed ? tracking.id : null,
        destination,
        platform: dto.platform,
        observedAt: dto.observedAt,
      })
      .orIgnore()
      .returning("*")
      .execute();
    if (inserted.raw.length === 0) return { kind: InsertKind.Repeated };
    const opening = manager.create(LinkOpening, inserted.raw[0]);
    if (!attributed) {
      return { kind: InsertKind.Unattributed, opening, ...tracking };
    }
    const context = messageContextSchema.parse(tracking.context);

    switch (tracking.channel) {
      case MessageChannel.Email:
        await manager.update(
          Mail,
          { cid: tracking.trackingId },
          { clickedLink: true },
        );
        break;
      case MessageChannel.Sms:
      // Before tracking, a click on an ID an email and a text shared credited
      // the text, and the click-rate chart still counts it there.
      case MessageChannel.Unknown:
        await manager.update(
          Mms,
          { cid: tracking.trackingId },
          { clickedLink: true },
        );
        break;
      default:
        throw new Error(
          `unknown message channel: ${tracking.channel satisfies never}`,
        );
    }
    const notificationId = tracking.actionEventNotif?.notificationId;
    if (notificationId) {
      await manager.update(
        Notification,
        { id: notificationId, readAt: IsNull() },
        { readAt: now },
      );
    }
    return { kind: InsertKind.Recorded, tracking, context, opening };
  }

  /**
   * Attributes a link sent before tracking to the reminder or recognition
   * that sent it, or to a forum reply through an in-app entry that kept its
   * ID, when that one record carried every message with its ID.
   * Any other legacy link's opening is stored without attribution, and only
   * marks its message clicked when one message carried its ID.
   */
  private async recoverLegacy(params: {
    manager: EntityManager;
    cid: string;
    now: Date;
  }): Promise<MessageTracking | Ownerless | InsertKind.Unknown> {
    const { manager, cid, now } = params;
    if (!LEGACY_CID.test(cid)) return InsertKind.Unknown;
    const mails = await manager.find(Mail, {
      select: { id: true },
      where: { cid },
    });
    const mmses = await manager.find(Mms, {
      select: { id: true },
      where: { cid },
    });
    if (mails.length + mmses.length === 0) return InsertKind.Unknown;
    const channel =
      mails.length && mmses.length
        ? MessageChannel.Unknown
        : mails.length
          ? MessageChannel.Email
          : MessageChannel.Sms;
    const messages = {
      mailIds: mails.map((mail) => mail.id),
      mmsIds: mmses.map((mms) => mms.id),
    };
    // A forum reply's or missed-suite notice's in-app entry shared its
    // message's ID, which another recipient's entry may share too.
    const entries = await manager.find(Notification, {
      relations: { user: true },
      where: { cid },
    });
    const entry = entries.length === 1 ? entries[0] : null;
    const owner = await legacyOwner({ manager, cid, messages, entry });
    if (
      owner &&
      !(await lockLive(manager, [{ target: User, id: owner.userId }]))
    ) {
      return InsertKind.Unknown;
    }

    if (entry && !entry.readAt && (!owner || entry.user?.id === owner.userId)) {
      await manager.update(Notification, { id: entry.id }, { readAt: now });
    }

    if (!owner) {
      if (mails.length + mmses.length === 1) {
        await manager.update(
          mails.length ? Mail : Mms,
          { cid },
          {
            clickedLink: true,
          },
        );
      }
      return { platform: POSTHOG_PLATFORM[channel] };
    }

    await manager
      .createQueryBuilder()
      .insert()
      .into(MessageTracking)
      .values({
        trackingId: cid,
        channel,
        legacy: true,
        source: owner.source,
        userId: owner.userId,
        waitlistEntryId: null,
        actionEventNotifId: owner.actionEventNotifId,
        context: messageContextSchema.parse(owner.context),
      })
      .orIgnore()
      .execute();
    return manager.findOneOrFail(MessageTracking, {
      where: { trackingId: cid },
      relations: { actionEventNotif: true },
    });
  }

  /**
   * A legacy link no recipient is recovered for still reaches PostHog, as it
   * did when browsers sent this event, under no person.
   */
  private captureOwnerless(
    params: { cid: string; opening: LinkOpening } & Ownerless,
  ): void {
    const { cid, opening, platform } = params;
    this.posthog.capture({
      event: AnalyticsEvent.NotifLinkClick,
      distinctId: `legacy_link_${cid}`,
      properties: {
        cid,
        platform,
        legacy: true,
        linkOpeningId: opening.id,
        openingId: opening.openingId,
        destination: opening.destination,
        clientPlatform: opening.platform,
        observedAt: opening.observedAt.toISOString(),
        $process_person_profile: false,
      },
    });
  }

  private capture(recorded: Recorded): void {
    const { tracking, context, opening } = recorded;
    this.posthog.capture({
      event: AnalyticsEvent.NotifLinkClick,
      distinctId:
        tracking.userId !== null
          ? String(tracking.userId)
          : `waitlist_entry_${tracking.waitlistEntryId}`,
      properties: {
        ...context,
        cid: tracking.trackingId,
        platform: POSTHOG_PLATFORM[tracking.channel],
        channel: tracking.channel,
        source: tracking.source,
        legacy: tracking.legacy,
        linkOpeningId: opening.id,
        openingId: opening.openingId,
        destination: opening.destination,
        clientPlatform: opening.platform,
        observedAt: opening.observedAt.toISOString(),
        // Nothing merges or deletes a person made for a waitlist entry.
        ...(tracking.userId === null && { $process_person_profile: false }),
      },
    });
  }
}
