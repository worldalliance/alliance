import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EventType } from "src/eventlog/event-log.entity";
import { EventLogService } from "src/eventlog/eventlog.service";
import { User } from "src/user/entities/user.entity";
import { lockPhoneNumber } from "src/user/user.utils";
import type { EntityManager, Repository } from "typeorm";
import { z } from "zod";
import { MmsOptout } from "./mms-optout.entity";

const changedRows = z.array(
  z.object({
    id: z.number(),
    name: z.string(),
    deletedAt: z.date().nullable(),
  }),
);

/**
 * Updates every account on the number, deleted ones included so a restored one
 * keeps the opt-out, and returns the live accounts the update changed. A member
 * who left the number while the update waited on their row is not among them.
 */
async function setUnsubscribed(
  manager: EntityManager,
  { phoneNumber, unsubscribed }: { phoneNumber: string; unsubscribed: boolean },
): Promise<Pick<User, "id" | "name">[]> {
  const { raw } = await manager
    .createQueryBuilder()
    .update(User)
    .set({ phoneNumberUnsubscribed: unsubscribed })
    .where({ phoneNumber })
    .returning(`"id", "name", "deletedAt"`)
    .execute();
  return changedRows.parse(raw).filter((user) => user.deletedAt === null);
}

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
        await lockPhoneNumber(manager, phoneNumber);
        const mmsOptoutRepository = manager.getRepository(MmsOptout);
        const matchingUsers = await setUnsubscribed(manager, {
          phoneNumber,
          unsubscribed: true,
        });

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
        message: `${user.name} unsubscribed from SMS (${reason})`,
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
    // Logs after commit, so a failed write never announces a resubscribe.
    const users = await this.userRepository.manager.transaction(
      async (manager) => {
        await lockPhoneNumber(manager, phoneNumber);
        return setUnsubscribed(manager, { phoneNumber, unsubscribed: false });
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
