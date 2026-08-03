import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { MmsOptout } from './mms-optout.entity';
import { EventLogService } from 'src/eventlog/eventlog.service';
import { EventType } from 'src/eventlog/event-log.entity';

/** Handles E.164 numbers; asynchronous audits avoid Twilio retries. */
@Injectable()
export class MmsUnsubService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventLogService: EventLogService,
  ) {}

  /** Applies STOP and audits all members sharing the number. */
  async unsubFromMms(
    phoneNumber: string,
    { reason, rawBody }: { reason: string; rawBody: string },
  ): Promise<void> {
    const users = await this.userRepository.manager.transaction(
      async (manager) => {
        const userRepository = manager.getRepository(User);
        const mmsOptoutRepository = manager.getRepository(MmsOptout);
        const matchingUsers = await userRepository.findBy({ phoneNumber });

        if (matchingUsers.length === 0) {
          return matchingUsers;
        }

        await mmsOptoutRepository.save(
          matchingUsers.map((user) =>
            mmsOptoutRepository.create({
              phoneNumber,
              reason,
              rawBody,
              user: { id: user.id },
            }),
          ),
        );
        await userRepository.update(
          { phoneNumber },
          { phoneNumberUnsubscribed: true },
        );
        return matchingUsers;
      },
    );

    if (users.length === 0) {
      this.eventLogService.sendMessage({
        type: EventType.SmsUnsubscribe,
        message: `Unhandled SMS opt-out from ${phoneNumber}`,
        blob: null,
        userId: null,
      });
      return;
    }
    for (const user of users) {
      this.eventLogService.sendMessage({
        type: EventType.SmsUnsubscribe,
        message: `${user.name} keyword unsubscribed from SMS`,
        userId: user.id,
        blob: null,
      });
    }
  }

  /** Applies START to all matching members without deleting opt-out audits. */
  async subscribeToMms(
    phoneNumber: string,
    { rawBody }: { rawBody: string },
  ): Promise<void> {
    // Read and write in one transaction, then log after commit so audits match
    // changed rows and failed writes never announce a resubscribe.
    const users = await this.userRepository.manager.transaction(
      async (manager) => {
        const userRepository = manager.getRepository(User);
        const matchingUsers = await userRepository.findBy({ phoneNumber });

        if (matchingUsers.length === 0) {
          return matchingUsers;
        }

        await userRepository.update(
          { phoneNumber },
          { phoneNumberUnsubscribed: false },
        );
        return matchingUsers;
      },
    );

    if (users.length === 0) {
      this.eventLogService.sendMessage({
        type: EventType.SmsResubscribe,
        message: `Unhandled SMS resubscribe from ${phoneNumber}`,
        blob: { phoneNumber, rawBody },
        userId: null,
      });
      return;
    }
    for (const user of users) {
      this.eventLogService.sendMessage({
        type: EventType.SmsResubscribe,
        message: `${user.name} keyword resubscribed to SMS`,
        userId: user.id,
        blob: { phoneNumber, rawBody },
      });
    }
  }

  async logUnhandledMessage(
    from: string,
    to: string,
    body: string,
  ): Promise<void> {
    this.eventLogService.sendMessage({
      type: EventType.SmsInbound,
      message: `Unhandled inbound SMS from ${from}: ${body}`,
      blob: { from, to, body },
      userId: null,
    });
  }
}
