import { nameParts } from "@alliance/common/nameParts";
import { R } from "@alliance/common/result";
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { milliseconds } from "date-fns";
import { CONTRACT_REMINDER_COPY } from "src/mail/contract-reminder-copy";
import { MailNotSentError, MailService } from "src/mail/mail.service";
import { Experiment } from "src/notifs/entities/experiment-assignment.entity";
import { assignExperimentArm } from "src/notifs/experiment-assignment";
import { User } from "src/user/entities/user.entity";
import { notifDeliveryEnabled } from "src/utils/notif-delivery";
import { DataSource, Repository } from "typeorm";
import { LOCK_KEYS } from "../notifs/lock-keys";
import { withPgAdvisoryLock } from "../notifs/lock-utils";

const [LOCK_KEY1, LOCK_KEY2] = LOCK_KEYS.contractReminder;

@Injectable()
export class ContractReminderWorker {
  private readonly logger = new Logger(ContractReminderWorker.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sendContractReminders() {
    if (!notifDeliveryEnabled()) {
      return;
    }

    const ran = await withPgAdvisoryLock(
      this.dataSource,
      LOCK_KEY1,
      LOCK_KEY2,
      async () => {
        const cutoff = new Date(Date.now() - milliseconds({ days: 1 }));

        const users = await this.userRepository
          .createQueryBuilder("user")
          .leftJoin("user.contractEvents", "ce")
          .where("user.createdAt <= :cutoff", { cutoff })
          .andWhere("ce.id IS NULL")
          .andWhere("user.contractReminderSentAt IS NULL")
          .getMany();

        if (users.length > 0) {
          this.logger.log(
            `Sending contract reminder emails to ${users.length} user(s)`,
          );
        }

        for (const user of users) {
          try {
            const arm = await assignExperimentArm(this.dataSource.manager, {
              experiment: Experiment.ContractReminder,
              userId: user.id,
            });
            // Marked before the send, so a lost write costs a missed reminder, not a second one.
            await this.userRepository.update(user.id, {
              contractReminderSentAt: new Date(),
            });
            const sent = await R.fromPromise(
              this.mailService.sendContractReminderEmail({
                userId: user.id,
                email: user.email,
                name: nameParts(user.name).firstname,
                copy: CONTRACT_REMINDER_COPY[arm],
              }),
            );
            // Any other failure may still have sent the mail, so it stays marked.
            if (!sent.ok && sent.error instanceof MailNotSentError) {
              await this.userRepository.update(user.id, {
                contractReminderSentAt: null,
              });
            }
            if (!sent.ok) throw sent.error;
          } catch (err) {
            this.logger.error(
              `Failed to send contract reminder to user ${user.id}`,
              err,
            );
          }
        }
      },
    );

    if (ran === null) {
      this.logger.log("contract reminder skipped bc of lock");
    }
  }
}
