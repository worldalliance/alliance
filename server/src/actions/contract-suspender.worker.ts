import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ActionsService } from 'src/actions/actions.service';
import { ContractService } from 'src/contract/contract.service';
import { EventType } from 'src/eventlog/event-log.entity';
import { EventLogService } from 'src/eventlog/eventlog.service';
import { MailService } from 'src/mail/mail.service';
import { MmsService } from 'src/mms/mms.service';
import { generateCIDForNotif } from 'src/notifs/notif-utils';
import { suspensionMessage } from 'src/notifs/textnotifcontents';
import {
  userActionNotifsEnabled_email,
  userActionNotifsEnabled_text,
} from 'src/user/user.utils';
import { DataSource } from 'typeorm';
import { LOCK_KEYS } from '../notifs/lock-keys';
import { withPgAdvisoryLock } from '../notifs/lock-utils';

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
  ) {}

  @Cron('*/10 * * * *')
  async processSuspensions() {
    if (
      !(
        process.env.NODE_ENV === 'production' ||
        process.env.SEND_DEV_NOTIFS === '1'
      )
    ) {
      return;
    }

    const ran = await withPgAdvisoryLock(
      this.dataSource,
      PROCESS_ONE_LOCK_KEY1,
      PROCESS_ONE_LOCK_KEY2,
      async () => {
        const now = new Date();

        const { usersToSuspend, suspendReasonKeys } =
          await this.actionsService.findUsersToSuspend(now);

        if (usersToSuspend.length > 0) {
          console.log(
            'suspending users for action failure: ',
            usersToSuspend.map((user) => user.name),
          );
        }

        for (const user of usersToSuspend) {
          const res = await this.contractService.suspendContract(
            user.id,
            true,
            suspendReasonKeys.get(user.id),
          );
          await this.eventLogService.sendMessage({
            type: EventType.ContractSuspended,
            message: `[${process.env.NODE_ENV}]: Suspending contract for ${user.name}. failure code ${suspendReasonKeys.get(user.id)}`,
            userId: user.id,
            blob: {
              suspendReason: suspendReasonKeys.get(user.id),
              automatic: true,
            },
          });
          if (res) {
            const cid = generateCIDForNotif();
            if (userActionNotifsEnabled_text(user)) {
              await this.mmsService.sendMms(
                user.phoneNumber!,
                suspensionMessage,
                [],
                cid,
              );
            }
            if (userActionNotifsEnabled_email(user)) {
              await this.mailService.sendContractSuspendedEmail(
                user.email,
                user.name,
              );
            }
          }
        }
      },
    );

    if (ran === null) {
      this.logger.log('suspender processOne skipped bc of lock');
    }
  }
}
