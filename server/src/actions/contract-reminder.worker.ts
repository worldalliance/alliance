import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { EmailType } from "src/mail/mail.entity";
import { MailService } from "src/mail/mail.service";
import { User } from "src/user/entities/user.entity";
import { DataSource, Repository } from "typeorm";
import { LOCK_KEYS } from "../notifs/lock-keys";
import { withPgAdvisoryLock } from "../notifs/lock-utils";

const [LOCK_KEY1, LOCK_KEY2] = LOCK_KEYS.contractReminder;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

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
    if (
      !(
        process.env.NODE_ENV === "production" ||
        process.env.SEND_DEV_NOTIFS === "1"
      )
    ) {
      return;
    }

    const ran = await withPgAdvisoryLock(
      this.dataSource,
      LOCK_KEY1,
      LOCK_KEY2,
      async () => {
        const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS_MS);

        // Find users who:
        // 1. Created their account more than 24 hours ago
        // 2. Have no contract events at all
        // 3. Haven't already received this reminder email
        const users = await this.userRepository
          .createQueryBuilder("user")
          .leftJoin("user.contractEvents", "ce")
          .where("user.createdAt <= :cutoff", { cutoff })
          .andWhere("user.isNotSignedUpPartialProfile = :partial", {
            partial: false,
          })
          .andWhere("ce.id IS NULL")
          .andWhere(
            `NOT EXISTS (
              SELECT 1 FROM mail
              WHERE mail."to" = "user"."email"
              AND mail."emailType" = :emailType
            )`,
            { emailType: EmailType.ContractReminder },
          )
          .getMany();

        if (users.length > 0) {
          this.logger.log(
            `Sending contract reminder emails to ${users.length} user(s)`,
          );
        }

        for (const user of users) {
          try {
            const firstName = user.name.split(" ")[0];
            await this.mailService.sendContractReminderEmail(
              user.email,
              firstName,
            );
          } catch (err) {
            this.logger.error(
              `Failed to send contract reminder to ${user.email}`,
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
