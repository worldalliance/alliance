import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import {
  ContractEvents,
  type ContractReinstatedPayload,
} from "src/contract/contract.events";
import { MailService } from "src/mail/mail.service";
import { MmsService } from "src/mms/mms.service";
import { NotificationKind } from "src/notification-settings/notification-kind";
import { NotificationPreferencesService } from "src/notification-settings/notification-preferences.service";
import { Notification } from "src/notifs/entities/notification.entity";
import { NotificationChannel } from "src/notifs/notif-utils";
import { sendBestEffort } from "src/notifs/send-best-effort";
import {
  reinstatementMessage,
  reinstatementTextMessage,
} from "src/notifs/textnotifcontents";
import { PushService } from "src/push/push.service";
import { tasksUrl } from "src/search/approutes";
import { isLatestSuspension } from "src/user/entities/contract-event.entity";
import { textReachable } from "src/user/user.utils";
import { DetachedWorkTracker } from "src/utils/detached-work";
import type { Repository } from "src/utils/Repository";

/**
 * Sends a reinstated member their push, text, and email once the signing
 * commits. Each channel is tried once; a failure is logged and never retried.
 */
@Injectable()
export class ContractReinstatedListener implements OnModuleDestroy {
  private readonly logger = new Logger(ContractReinstatedListener.name);
  private readonly detachedWork = new DetachedWorkTracker();

  private readonly onContractReinstated = ({
    notificationId,
  }: ContractReinstatedPayload) => {
    this.detachedWork.track(
      this.deliver(notificationId).catch((error: unknown) =>
        this.logger.error(
          `Failed to deliver reinstatement notification ${notificationId}`,
          error,
        ),
      ),
    );
  };

  constructor(
    private readonly eventEmitter: EventEmitter2,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly mailService: MailService,
    private readonly mmsService: MmsService,
    private readonly pushService: PushService,
    private readonly preferences: NotificationPreferencesService,
  ) {
    this.eventEmitter.on(ContractEvents.Reinstated, this.onContractReinstated);
  }

  async onModuleDestroy() {
    this.eventEmitter.off(ContractEvents.Reinstated, this.onContractReinstated);
    await this.detachedWork.drain();
  }

  async deliver(notificationId: number): Promise<void> {
    const notif = await this.notificationRepository.findOneOrFail({
      where: { id: notificationId },
      relations: { user: { contractEvents: true } },
    });
    const { user } = notif;
    if (
      notif.reinstatedSuspensionId === null ||
      !isLatestSuspension(user.contractEvents, notif.reinstatedSuspensionId)
    ) {
      this.logger.log(
        `Skipping reinstatement notification ${notif.id}: paused again since`,
      );
      return;
    }
    const channels = await this.preferences.channelsFor(
      user,
      NotificationKind.ContractReinstated,
    );
    const send = (channel: NotificationChannel, run: () => Promise<unknown>) =>
      sendBestEffort({
        logger: this.logger,
        what: `reinstatement ${channel} to user ${user.id}`,
        send: run,
      });

    if (channels.includes(NotificationChannel.Push)) {
      await send(NotificationChannel.Push, async () =>
        this.pushService.sendMessages(
          await this.pushService.getPushForAllUserDevices(user.id, {
            userId: user.id,
            body: reinstatementMessage,
            screen: tasksUrl(),
            notification: notif,
            idempotencyKey: `reinstated-${notif.id}`,
          }),
        ),
      );
    }
    if (channels.includes(NotificationChannel.Text) && textReachable(user)) {
      await send(NotificationChannel.Text, () =>
        this.mmsService.sendMms({
          to: user.phoneNumber,
          userId: user.id,
          body: reinstatementTextMessage(tasksUrl(true)),
          mediaUrls: [],
          tracking: null,
        }),
      );
    }
    if (channels.includes(NotificationChannel.Email)) {
      await send(NotificationChannel.Email, () =>
        this.mailService.sendContractReinstatedEmail({
          email: user.email,
          name: user.name,
        }),
      );
    }
  }
}
