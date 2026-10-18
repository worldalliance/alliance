import { R } from "@alliance/common/result";
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ActionsService } from "src/actions/actions.service";
import { ContractService } from "src/contract/contract.service";
import { EventType } from "src/eventlog/event-log.entity";
import { EventLogService } from "src/eventlog/eventlog.service";
import { MailService } from "src/mail/mail.service";
import { MmsService } from "src/mms/mms.service";
import { NotificationKind } from "src/notification-settings/notification-kind";
import { NotificationPreferencesService } from "src/notification-settings/notification-preferences.service";
import { NotificationChannel } from "src/notifs/notif-utils";
import { suspensionMessage } from "src/notifs/textnotifcontents";
import { PushService } from "src/push/push.service";
import { textReachable } from "src/user/user.utils";
import { notifDeliveryEnabled } from "src/utils/notif-delivery";
import { DataSource } from "typeorm";
import { LOCK_KEYS } from "../notifs/lock-keys";
import { withPgAdvisoryLock } from "../notifs/lock-utils";

const [PROCESS_ONE_LOCK_KEY1, PROCESS_ONE_LOCK_KEY2] =
  LOCK_KEYS.contractSuspender;

@Injectable()
export class ContractSuspenderWorker {
  private readonly logger = new Logger(ContractSuspenderWorker.name);
  constructor(
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
    private readonly mmsService: MmsService,
    private readonly actionsService: ActionsService,
    private readonly contractService: ContractService,
    private readonly eventLogService: EventLogService,
    private readonly pushService: PushService,
    private readonly preferences: NotificationPreferencesService,
  ) {}

  @Cron("*/10 * * * *")
  async processSuspensions() {
    if (!notifDeliveryEnabled()) {
      return;
    }

    const ran = await withPgAdvisoryLock(
      this.dataSource,
      PROCESS_ONE_LOCK_KEY1,
      PROCESS_ONE_LOCK_KEY2,
      async () => {
        const now = new Date();

        const candidates = await this.actionsService.findUsersToSuspend(now);

        if (candidates.length > 0) {
          this.logger.log(
            `Suspending contracts for user(s) ${candidates.map(({ user }) => user.id).join(", ")}`,
          );
        }
        const preferences = await this.preferences.load({
          userIds: candidates.map(({ user }) => user.id),
          kinds: [NotificationKind.ContractSuspended],
        });

        for (const { user, reasonKey } of candidates) {
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

          await this.sendBestEffort(
            `suspension event log for user ${user.id}`,
            () =>
              this.eventLogService.sendMessage({
                type: EventType.ContractSuspended,
                message: `[${process.env.NODE_ENV}]: Suspending contract for ${user.name}. failure code ${reasonKey}`,
                userId: user.id,
                blob: {
                  suspendReason: reasonKey,
                  automatic: true,
                },
              }),
          );
          const wants = (channel: NotificationChannel) =>
            preferences.wants({
              userId: user.id,
              kind: NotificationKind.ContractSuspended,
              channel,
            });
          if (wants(NotificationChannel.Text) && textReachable(user)) {
            await this.sendBestEffort(
              `suspension text to user ${user.id}`,
              () =>
                this.mmsService.sendMms({
                  to: user.phoneNumber,
                  userId: user.id,
                  body: suspensionMessage,
                  mediaUrls: [],
                  tracking: null,
                }),
            );
          }
          if (wants(NotificationChannel.Push)) {
            await this.sendBestEffort(
              `suspension push to user ${user.id}`,
              async () =>
                this.pushService.sendMessages(
                  await this.pushService.getPushForAllUserDevices(user.id, {
                    userId: user.id,
                    body: suspensionMessage.trim(),
                    screen: "/membership",
                    idempotencyKey: `suspension-${user.id}-${reasonKey}`,
                  }),
                ),
            );
          }
          if (wants(NotificationChannel.Email)) {
            await this.sendBestEffort(
              `suspension email to user ${user.id}`,
              () =>
                this.mailService.sendContractSuspendedEmail(
                  user.email,
                  user.name,
                ),
            );
          }
        }
      },
    );

    if (ran === null) {
      this.logger.log("suspender processOne skipped bc of lock");
    }
  }

  /**
   * The contract is already suspended by this point and the user drops out of
   * the next run's candidates, so nothing sent after it is ever retried — log
   * the failure and keep going rather than losing the rest of the batch.
   */
  private async sendBestEffort(
    what: string,
    send: () => Promise<unknown>,
  ): Promise<void> {
    const sent = await R.fromPromiseFn(send);
    if (R.isFailure(sent)) {
      this.logger.error(`Failed to send ${what}`, sent.error);
    }
  }
}
