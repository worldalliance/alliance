import { AnalyticsEvent } from "@alliance/common/analytics";
import {
  LINK_OPENING_DEADLINE_MS,
  normalizeDestination,
} from "@alliance/common/linkOpening";
import { R, type Result } from "@alliance/common/result";
import { Injectable } from "@nestjs/common";
import { milliseconds } from "date-fns";
import { Mail } from "src/mail/mail.entity";
import { Mms } from "src/mms/mms.entity";
import { Notification } from "src/notifs/entities/notification.entity";
import { PosthogService } from "src/posthog/posthog.service";
import { isForeignKeyViolation } from "src/utils/db-errors";
import { DataSource, type EntityManager, IsNull } from "typeorm";
import type { RecordLinkOpeningDto } from "./dto/link-opening.dto";
import { LinkOpening } from "./link-opening.entity";
import {
  MessageChannel,
  type MessageContext,
  messageContextSchema,
  MessageTracking,
} from "./message-tracking.entity";

export enum LinkOpeningRejection {
  Invalid = "invalid",
  /** No such message, or its recipient has been deleted. */
  Unknown = "unknown",
}

const CLOCK_SKEW_MS = milliseconds({ hours: 1 });

/** The `platform` the browser reported before the server sent this event. */
const POSTHOG_PLATFORM: Record<MessageChannel, string> = {
  [MessageChannel.Email]: "email",
  [MessageChannel.Sms]: "mms",
};

enum InsertKind {
  Recorded = "recorded",
  Repeated = "repeated",
  Unknown = "unknown",
}

type Recorded = {
  tracking: MessageTracking;
  context: MessageContext;
  opening: LinkOpening;
};

type Insertion =
  | ({ kind: InsertKind.Recorded } & Recorded)
  | { kind: Exclude<InsertKind, InsertKind.Recorded> };

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

    const recorded = await R.fromPromise(
      this.dataSource.transaction((manager) =>
        this.insert({
          manager,
          dto,
          // Normalized here rather than checked, so an older client's
          // normalization still records its opening.
          destination: normalizeDestination(dto.destination),
          now,
        }),
      ),
    );
    if (R.isFailure(recorded)) {
      if (isForeignKeyViolation(recorded.error)) {
        return R.failure(LinkOpeningRejection.Unknown);
      }
      throw recorded.error;
    }
    const insertion = recorded.value;
    switch (insertion.kind) {
      case InsertKind.Recorded:
        this.capture(insertion);
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
    const tracking = await manager.findOne(MessageTracking, {
      where: { trackingId: dto.trackingId },
      relations: { actionEventNotif: true },
    });
    if (!tracking) return { kind: InsertKind.Unknown };
    const context = messageContextSchema.parse(tracking.context);

    const inserted = await manager
      .createQueryBuilder()
      .insert()
      .into(LinkOpening)
      .values({
        openingId: dto.openingId,
        messageTrackingId: tracking.id,
        destination,
        platform: dto.platform,
        observedAt: dto.observedAt,
      })
      .orIgnore()
      .returning("*")
      .execute();
    if (inserted.raw.length === 0) return { kind: InsertKind.Repeated };
    const opening = manager.create(LinkOpening, inserted.raw[0]);

    switch (tracking.channel) {
      case MessageChannel.Email:
        await manager.update(
          Mail,
          { cid: tracking.trackingId },
          { clickedLink: true },
        );
        break;
      case MessageChannel.Sms:
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
