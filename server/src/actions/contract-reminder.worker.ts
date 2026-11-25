import { nameParts } from "@alliance/common/nameParts";
import { R } from "@alliance/common/result";
import { Injectable, Logger } from "@nestjs/common";
import { WithoutOverlapping } from "@nestjs/locks";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { milliseconds } from "date-fns";
import { assertLeaseHeld, CronLease } from "src/leases/cron-lease";
import { CONTRACT_REMINDER_COPY } from "src/mail/contract-reminder-copy";
import { MailNotSentError, MailService } from "src/mail/mail.service";
import { Experiment } from "src/notifs/entities/experiment-assignment.entity";
import { assignExperimentArm } from "src/notifs/experiment-assignment";
import { User } from "src/user/entities/user.entity";
import { notifDeliveryEnabled } from "src/utils/notif-delivery";
import { DataSource, IsNull, Repository } from "typeorm";

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
  @WithoutOverlapping({ key: CronLease.ContractReminders })
  async sendContractReminders() {
    if (!notifDeliveryEnabled()) {
      return;
    }
    await this.sendDueReminders();
  }

  /** Skips the lease and the delivery gate; production runs it through sendContractReminders. */
  async sendDueReminders() {
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
      assertLeaseHeld();
      try {
        const arm = await assignExperimentArm(this.dataSource.manager, {
          experiment: Experiment.ContractReminder,
          userId: user.id,
        });
        // Claimed before the send, so a lost write costs a missed reminder,
        // not a second one.
        const claim = await this.userRepository.update(
          { id: user.id, contractReminderSentAt: IsNull() },
          { contractReminderSentAt: new Date() },
        );
        if (claim.affected !== 1) continue;
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
  }
}
