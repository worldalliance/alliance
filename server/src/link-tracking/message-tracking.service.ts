import { thrownMessage, thrownStack } from "@alliance/common/errorMessage";
import { R } from "@alliance/common/result";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { inviteClaimantSql } from "src/user/invite-claim";
import type { Repository } from "src/utils/Repository";
import { randomToken } from "src/utils/random";
import type { EntityManager } from "typeorm";
import {
  MessageChannel,
  type MessageContext,
  messageContextSchema,
  type MessageSource,
  MessageTracking,
} from "./message-tracking.entity";

export type MessageOwner = { userId: number } | { waitlistEntryId: number };

export type TrackedMessage = {
  owner: MessageOwner;
  source: MessageSource;
  context: MessageContext;
  actionEventNotifId: number | null;
};

@Injectable()
export class MessageTrackingService {
  private readonly logger = new Logger(MessageTrackingService.name);

  constructor(
    @InjectRepository(MessageTracking)
    private readonly trackingRepository: Repository<MessageTracking>,
  ) {}

  async track(params: {
    message: TrackedMessage;
    channel: MessageChannel.Email | MessageChannel.Sms;
  }): Promise<string> {
    const { message, channel } = params;
    const trackingId = randomToken(12);
    await this.trackingRepository.insert({
      trackingId,
      channel,
      source: message.source,
      userId: "userId" in message.owner ? message.owner.userId : null,
      waitlistEntryId:
        "waitlistEntryId" in message.owner
          ? message.owner.waitlistEntryId
          : null,
      actionEventNotifId: message.actionEventNotifId,
      context: messageContextSchema.parse(message.context),
    });
    return trackingId;
  }

  /**
   * Removes the tracking of a message that was never sent or recorded. A
   * failure is logged, not thrown, so the send's own failure is what callers
   * report.
   */
  async discard(trackingId: string): Promise<void> {
    const discarded = await R.fromPromise(
      this.trackingRepository.delete({ trackingId }),
    );
    if (!discarded.ok) {
      this.logger.error(
        `Failed to discard tracking ${trackingId}: ${thrownMessage(discarded.error)}`,
        thrownStack(discarded.error),
      );
    }
  }

  /** The in-app notification the tracked message's reminder created. */
  async notificationIdFor(trackingId: string): Promise<number | null> {
    const tracking = await this.trackingRepository.findOne({
      where: { trackingId },
      relations: { actionEventNotif: true },
    });
    return tracking?.actionEventNotif?.notificationId ?? null;
  }
}

/**
 * Removes the waitlist emails' attribution for each entry whose invite the
 * member claimed, with their openings. Call before deleting the member.
 * Another claimant of the same entry doesn't keep it: a claim is the only
 * stored link to the recipient, and a forwarded invite can't be told apart.
 */
export async function deleteClaimedWaitlistTracking(params: {
  manager: EntityManager;
  userId: number;
}): Promise<void> {
  await params.manager
    .createQueryBuilder()
    .delete()
    .from(MessageTracking)
    .where(
      `"waitlistEntryId" IN (SELECT invite."waitlistEntryId" FROM onetime_invite invite JOIN "user" claimant ON ${inviteClaimantSql({ invite: "invite", claimant: "claimant" })} WHERE claimant.id = :userId)`,
      { userId: params.userId },
    )
    .execute();
}
