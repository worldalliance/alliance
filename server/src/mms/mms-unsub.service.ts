import { R } from "@alliance/common/result";
import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { EventType } from "src/eventlog/event-log.entity";
import type { EventPayloads } from "src/eventlog/event-messages";
import { EventLogService } from "src/eventlog/eventlog.service";
import { User } from "src/user/entities/user.entity";
import { lockPhoneNumber } from "src/user/user.utils";
import type { EntityManager, Repository } from "typeorm";
import { z } from "zod";
import { numberOptedOut, setNumberOptedOut } from "./mms-number.service";
import { MmsOptout } from "./mms-optout.entity";
import { MmsThread } from "./mms-thread.entity";
import { emitThreadChanged } from "./mms.events";
import { OptOutSource } from "./opt-out-source";

export type OptOutRequest =
  | { kind: OptOutSource.Keyword; rawBody: string }
  | { kind: OptOutSource.Staff; adminId: number };

function storedOptOut(request: OptOutRequest): {
  reason: string;
  rawBody: string;
} {
  switch (request.kind) {
    case OptOutSource.Keyword:
      return { reason: "stop_keyword", rawBody: request.rawBody };
    case OptOutSource.Staff:
      return { reason: `marked_by_staff:${request.adminId}`, rawBody: "" };
    default:
      throw new Error(`unknown opt-out source: ${request satisfies never}`);
  }
}

const changedRows = z.array(
  z.object({
    id: z.number(),
    name: z.string(),
    deletedAt: z.date().nullable(),
  }),
);

/**
 * Updates every account on the number, deleted ones included so a restored one
 * keeps the opt-out, and returns the live accounts the update changed: the
 * number's holder, if any. A member who left the number while the update waited
 * on their row is not among them.
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
  private readonly logger = new Logger(MmsUnsubService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventLogService: EventLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Opts the number out of texts and audits it against its live holder, if any. */
  async unsubFromMms(
    phoneNumber: string,
    request: OptOutRequest,
  ): Promise<void> {
    const { reason, rawBody } = storedOptOut(request);
    // Before the opt-out, so a failed lookup can't fail one that was saved.
    const source: EventPayloads[EventType.SmsUnsubscribe]["source"] =
      request.kind === OptOutSource.Staff
        ? {
            kind: OptOutSource.Staff,
            staff: await this.userRepository.findOneOrFail({
              where: { id: request.adminId },
              withDeleted: true,
            }),
          }
        : request;
    const users = await this.userRepository.manager.transaction(
      async (manager) => {
        await lockPhoneNumber(manager, phoneNumber);
        const mmsOptoutRepository = manager.getRepository(MmsOptout);
        const matchingUsers = await setUnsubscribed(manager, {
          phoneNumber,
          unsubscribed: true,
        });
        await setNumberOptedOut(manager, { phoneNumber, optedOut: true });
        const holders = matchingUsers.length > 0 ? matchingUsers : [null];
        await mmsOptoutRepository.save(
          holders.map((user) =>
            mmsOptoutRepository.create({
              phoneNumber,
              reason,
              rawBody,
              user: user && { id: user.id },
            }),
          ),
        );
        return matchingUsers;
      },
    );

    emitThreadChanged(this.eventEmitter, {
      phoneNumber,
      needsReplyChanged: true,
    });
    if (users.length === 0) {
      this.eventLogService.sendMessage({
        type: EventType.SmsUnsubscribe,
        payload: { phoneNumber, member: null, source },
        blob: null,
        userId: null,
      });
      return;
    }
    for (const user of users) {
      this.eventLogService.sendMessage({
        type: EventType.SmsUnsubscribe,
        payload: { phoneNumber, member: user, source },
        userId: user.id,
        blob: null,
      });
    }
  }

  /** Applies START to the number and its holders without deleting opt-out audits. */
  async subscribeToMms(
    phoneNumber: string,
    { rawBody }: { rawBody: string },
  ): Promise<void> {
    // Logs after commit, so a failed write never announces a resubscribe.
    const users = await this.userRepository.manager.transaction(
      async (manager) => {
        await lockPhoneNumber(manager, phoneNumber);
        const matchingUsers = await setUnsubscribed(manager, {
          phoneNumber,
          unsubscribed: false,
        });
        await setNumberOptedOut(manager, { phoneNumber, optedOut: false });
        return matchingUsers;
      },
    );

    emitThreadChanged(this.eventEmitter, {
      phoneNumber,
      needsReplyChanged: true,
    });
    if (users.length === 0) {
      this.eventLogService.sendMessage({
        type: EventType.SmsResubscribe,
        payload: { phoneNumber, member: null, rawBody },
        blob: { phoneNumber, rawBody },
        userId: null,
      });
      return;
    }
    for (const user of users) {
      this.eventLogService.sendMessage({
        type: EventType.SmsResubscribe,
        payload: { phoneNumber, member: user, rawBody },
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
    const found = await R.fromPromise(
      Promise.all([
        this.userRepository.find({
          where: { phoneNumber: from },
          select: { id: true, name: true },
        }),
        numberOptedOut(this.userRepository.manager, from),
        this.userRepository.manager.findOneByOrFail(MmsThread, {
          phoneNumber: from,
        }),
      ]),
    );
    if (!found.ok) {
      this.logger.error(
        "Could not look up the number for an unhandled text",
        found.error,
      );
      return;
    }
    const [members, optedOut, thread] = found.value;
    this.eventLogService.sendMessage({
      type: EventType.SmsInbound,
      payload: {
        phoneNumber: from,
        threadId: thread.id,
        members,
        optedOut,
        body,
      },
      blob: { from, to, body },
      userId: members.length === 1 ? members[0].id : null,
    });
  }
}
