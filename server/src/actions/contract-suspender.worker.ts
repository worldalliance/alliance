import { R } from "@alliance/common/result";
import { Injectable, Logger } from "@nestjs/common";
import { WithoutOverlapping } from "@nestjs/locks";
import { Cron } from "@nestjs/schedule";
import { ActionSuspensionService } from "src/actions/action-suspension.service";
import { ContractService } from "src/contract/contract.service";
import { EventType } from "src/eventlog/event-log.entity";
import { EventLogService } from "src/eventlog/eventlog.service";
import { assertLeaseHeld, CronLease } from "src/leases/cron-lease";
import { MailService } from "src/mail/mail.service";
import { MmsService } from "src/mms/mms.service";
import { NotificationKind } from "src/notification-settings/notification-kind";
import { NotificationPreferencesService } from "src/notification-settings/notification-preferences.service";
import { NotificationChannel } from "src/notifs/notif-utils";
import { sendBestEffort } from "src/notifs/send-best-effort";
import { suspensionMessage } from "src/notifs/textnotifcontents";
import { PushService } from "src/push/push.service";
import { User } from "src/user/entities/user.entity";
import { textReachable } from "src/user/user.utils";
import { notifDeliveryEnabled } from "src/utils/notif-delivery";
import { DataSource, In } from "typeorm";

@Injectable()
export class ContractSuspenderWorker {
  private readonly logger = new Logger(ContractSuspenderWorker.name);
  constructor(
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
    private readonly mmsService: MmsService,
    private readonly suspensionService: ActionSuspensionService,
    private readonly contractService: ContractService,
    private readonly eventLogService: EventLogService,
    private readonly pushService: PushService,
    private readonly preferences: NotificationPreferencesService,
  ) {}

  @Cron("*/10 * * * *")
  @WithoutOverlapping({ key: CronLease.ContractSuspensions })
  async processSuspensions() {
    if (!notifDeliveryEnabled()) {
      return;
    }
    await this.suspendDue();
  }

  /** Skips the lease and the delivery gate; production runs it through processSuspensions. */
  async suspendDue() {
    const now = new Date();

    const candidates = await this.suspensionService.findUsersToSuspend(now);

    if (candidates.length === 0) return;
    const userIds = candidates.map(({ user }) => user.id);
    this.logger.log(`Suspending contracts for user(s) ${userIds.join(", ")}`);
    const preferences = await this.preferences.load({
      userIds,
      kinds: [NotificationKind.ContractSuspended],
    });
    const referredUsers = new Map(
      (
        await this.dataSource.getRepository(User).find({
          where: { id: In(userIds) },
          relations: { referredBy: true, referredByCampaign: true },
        })
      ).map((user) => [user.id, user]),
    );

    for (const { user, reasonKey, missedSuites } of candidates) {
      assertLeaseHeld();
      const suspension = await R.fromPromiseFn(() =>
        this.contractService.suspendContract({
          userId: user.id,
          automatic: true,
          autoSuspendKey: reasonKey,
        }),
      );
      if (R.isFailure(suspension)) {
        this.logger.error(
          `Failed to suspend contract for user ${user.id}, failure code ${reasonKey}`,
          suspension.error,
        );
        continue;
      }

      // The user drops out of the next run's candidates once suspended, so
      // nothing sent from here on is ever retried.
      await sendBestEffort({
        logger: this.logger,
        what: `suspension event log for user ${user.id}`,
        send: () =>
          this.eventLogService.sendMessage({
            type: EventType.ContractSuspended,
            payload: {
              member: referredUsers.get(user.id) ?? user,
              automatic: true,
              missedSuites,
            },
            userId: user.id,
            blob: {
              suspendReason: reasonKey,
              automatic: true,
            },
          }),
      });
      const wants = (channel: NotificationChannel) =>
        preferences.wants({
          userId: user.id,
          kind: NotificationKind.ContractSuspended,
          channel,
        });
      if (wants(NotificationChannel.Text) && textReachable(user)) {
        await sendBestEffort({
          logger: this.logger,
          what: `suspension text to user ${user.id}`,
          send: () =>
            this.mmsService.sendMms({
              to: user.phoneNumber,
              userId: user.id,
              body: suspensionMessage,
              mediaUrls: [],
              tracking: null,
            }),
        });
      }
      if (wants(NotificationChannel.Push)) {
        await sendBestEffort({
          logger: this.logger,
          what: `suspension push to user ${user.id}`,
          send: async () =>
            this.pushService.sendMessages(
              await this.pushService.getPushForAllUserDevices(user.id, {
                userId: user.id,
                body: suspensionMessage.trim(),
                screen: "/membership",
                idempotencyKey: `suspension-${user.id}-${reasonKey}`,
              }),
            ),
        });
      }
      if (wants(NotificationChannel.Email)) {
        await sendBestEffort({
          logger: this.logger,
          what: `suspension email to user ${user.id}`,
          send: () =>
            this.mailService.sendContractSuspendedEmail(user.email, user.name),
        });
      }
    }
  }
}
