import { phoneSearchTerm } from "@alliance/common/phone";
import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "src/user/entities/user.entity";
import type { Repository } from "src/utils/Repository";
import type { MessageStatus } from "twilio/lib/rest/api/v2010/account/message";
import {
  type EntityManager,
  In,
  IsNull,
  type SelectQueryBuilder,
} from "typeorm";
import { z } from "zod";
import { MmsNumberService, optedOutSql } from "./mms-number.service";
import { MmsThreadEvent, MmsThreadEventKind } from "./mms-thread-event.entity";
import { Mms, MmsDirection } from "./mms.entity";
import { emitThreadChanged } from "./mms.events";

export enum ReplyState {
  NeedsReply = "needs_reply",
  Handled = "handled",
  Answered = "answered",
}

export type ThreadRef = { id: string; phoneNumber: string };

export type NeedsReplyThread = {
  thread: ThreadRef;
  members: User[];
  lastMessageBody: string;
  waitingSince: Date;
};

export type NeedsReplyMember = {
  user: User;
  lastMessageBody: string;
  waitingSince: Date;
};

const unansweredRow = z.object({
  id: z.number(),
  phoneNumber: z.string(),
  createdAt: z.date(),
  lastMessageBody: z.string(),
});

/** A mark on a number's texts through `throughId`, a text in its thread. */
export type NumberMark = {
  phoneNumber: string;
  throughId: number;
  adminId: number;
};

export const ANSWERS_MEMBER: Record<MessageStatus, boolean> = {
  queued: true,
  sending: true,
  sent: true,
  delivered: true,
  accepted: true,
  scheduled: true,
  read: true,
  partially_delivered: true,
  failed: false,
  undelivered: false,
  canceled: false,
  receiving: false,
  received: false,
};

const ANSWERING_STATUSES = Object.entries(ANSWERS_MEMBER)
  .filter(([, answers]) => answers)
  .map(([status]) => status);

export type ThreadSummary = {
  thread: ThreadRef;
  members: User[];
  lastMessageBody: string;
  lastMessageDirection: MmsDirection;
  lastMessageAt: Date;
};

export type ThreadList = { threads: ThreadSummary[]; hasMore: boolean };

/** Inbound texts Needs reply counts, after the number's launch cutoff, that no
 * staff reply has followed, handled ones included, from a query aliased
 * `inbound`. */
const unanswered = (query: SelectQueryBuilder<Mms>) =>
  query
    .andWhere("inbound.direction = :inbound", {
      inbound: MmsDirection.Inbound,
    })
    .andWhere("inbound.keyword IS NULL")
    .andWhere(
      `NOT EXISTS (
        SELECT 1 FROM mms reply
        WHERE reply."memberPhoneNumber" = inbound."memberPhoneNumber"
          AND reply."deletedAt" IS NULL
          AND (reply."createdAt", reply.id) > (inbound."createdAt", inbound.id)
          AND reply."sentById" IS NOT NULL
          AND reply.status IN (:...answering)
      )`,
      { answering: ANSWERING_STATUSES },
    )
    .andWhere(
      `NOT EXISTS (
        SELECT 1 FROM mms_thread launch
        JOIN mms cutoff ON cutoff.id = launch."launchCutoffId"
        WHERE launch."phoneNumber" = inbound."memberPhoneNumber"
          AND (inbound."createdAt", inbound.id) <= (cutoff."createdAt", cutoff.id)
      )`,
    );

const latestRow = z.object({
  phoneNumber: z.string(),
  id: z.number(),
  createdAt: z.date(),
  body: z.string(),
  direction: z.enum(MmsDirection),
});

@Injectable()
export class MmsInboxService {
  constructor(
    @InjectRepository(Mms)
    private readonly mmsRepository: Repository<Mms>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly mmsNumberService: MmsNumberService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async replyState(phoneNumber: string): Promise<ReplyState> {
    const { handled } = z
      .object({ handled: z.boolean().nullable() })
      .parse(
        await this.unansweredOf(phoneNumber)
          .select('bool_and(inbound."handledEventId" IS NOT NULL)', "handled")
          .getRawOne(),
      );
    if (handled === null) return ReplyState.Answered;
    return handled ? ReplyState.Handled : ReplyState.NeedsReply;
  }

  private unansweredOf(
    phoneNumber: string,
    manager: EntityManager = this.mmsRepository.manager,
  ) {
    return unanswered(
      manager
        .createQueryBuilder(Mms, "inbound")
        .where("inbound.memberPhoneNumber = :phoneNumber", { phoneNumber }),
    );
  }

  /** Marks the number's unanswered texts up to `throughId`, the newest text
   * staff could see, so one arriving meanwhile still needs a reply. */
  async markHandled(params: NumberMark): Promise<void> {
    return this.mark(params, async ({ manager, phoneNumber, record }) => {
      const texts = await this.unansweredOf(phoneNumber, manager)
        .select("inbound.id")
        .andWhere('inbound."handledEventId" IS NULL')
        .andWhere(
          `(inbound."createdAt", inbound.id) <= (SELECT "createdAt", id FROM mms WHERE id = :throughId)`,
          { throughId: params.throughId },
        )
        .orderBy("inbound.id")
        .setLock("pessimistic_write")
        .getMany();
      if (texts.length === 0) return;
      await manager.update(
        Mms,
        { id: In(texts.map((text) => text.id)), handledEventId: IsNull() },
        { handledEventId: await record(MmsThreadEventKind.MarkedHandled) },
      );
    });
  }

  async markNeedsReply(params: NumberMark): Promise<void> {
    return this.mark(params, async ({ manager, phoneNumber, record }) => {
      const texts = await this.unansweredOf(phoneNumber, manager)
        .select("inbound.id")
        .andWhere('inbound."handledEventId" IS NOT NULL')
        .orderBy("inbound.id")
        .setLock("pessimistic_write")
        .getMany();
      if (texts.length === 0) return;
      await record(MmsThreadEventKind.MarkedNeedsReply);
      await manager.update(
        Mms,
        { id: In(texts.map((text) => text.id)) },
        { handledEventId: null },
      );
    });
  }

  /** `apply` calls `record` only when it changes texts, so a mark that changes
   * nothing leaves no history and announces nothing. `apply` locks the texts it
   * reads in id order, so a concurrent mark of the same kind on the same number
   * waits and then finds them changed. A mark of the opposite kind reads the
   * other texts and doesn't wait. */
  private async mark(
    params: NumberMark,
    apply: (input: {
      manager: EntityManager;
      phoneNumber: string;
      record: (kind: MmsThreadEventKind) => Promise<number>;
    }) => Promise<void>,
  ): Promise<void> {
    let changed = false;
    await this.mmsRepository.manager.transaction(async (manager) => {
      const record = async (kind: MmsThreadEventKind) => {
        changed = true;
        const event = await manager.save(
          manager.create(MmsThreadEvent, {
            kind,
            afterMmsId: params.throughId,
            markedById: params.adminId,
          }),
        );
        return event.id;
      };
      await apply({ manager, phoneNumber: params.phoneNumber, record });
    });
    if (changed) {
      emitThreadChanged(this.eventEmitter, {
        phoneNumber: params.phoneNumber,
        needsReplyChanged: true,
      });
    }
  }

  /** Longest-waiting first, timed from each number's oldest unanswered text.
   * STOP and START texts, which the webhook acts on and Twilio answers, neither
   * list a number nor hide an earlier text that needs a reply. */
  async needsReply(): Promise<NeedsReplyThread[]> {
    const oldest = (await this.unansweredTexts()).toSorted(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id,
    );
    const numbers = oldest.map((row) => row.phoneNumber);
    const [threads, members] = await Promise.all([
      this.threadRefs(numbers),
      this.membersByNumber(numbers),
    ]);
    return oldest.map((row, index) => ({
      thread: threads[index],
      members: members.get(row.phoneNumber) ?? [],
      lastMessageBody: row.lastMessageBody,
      waitingSince: row.createdAt,
    }));
  }

  /** BACKCOMPAT(mms-thread-ids): Needs reply as admin builds before per-number
   * threads read it, one row per member; remove once no deployed admin build
   * calls GET needs-reply. */
  async needsReplyMembers(): Promise<NeedsReplyMember[]> {
    return (await this.needsReply()).flatMap((entry) =>
      entry.members.map((user) => ({
        user,
        lastMessageBody: entry.lastMessageBody,
        waitingSince: entry.waitingSince,
      })),
    );
  }

  /** Numbers with an inbound or staff text, by their latest such text, newest
   * first; automated texts alone don't make a conversation. */
  async list(params: {
    page: number;
    limit: number;
    search?: string;
  }): Promise<ThreadList> {
    const term = phoneSearchTerm(params.search);
    const query = this.mmsRepository
      .createQueryBuilder("mms")
      .select('mms."memberPhoneNumber"', "phoneNumber")
      .addSelect("mms.id", "id")
      .addSelect('mms."createdAt"', "createdAt")
      .addSelect("mms.body", "body")
      .addSelect("mms.direction", "direction")
      .distinctOn(['mms."memberPhoneNumber"'])
      .where(`(mms.direction = :inbound OR mms."sentById" IS NOT NULL)`, {
        inbound: MmsDirection.Inbound,
      })
      // Descending throughout, so the partial index is read backward unsorted.
      .orderBy('mms."memberPhoneNumber"', "DESC")
      .addOrderBy('mms."createdAt"', "DESC")
      .addOrderBy("mms.id", "DESC");
    if (term) {
      query.andWhere(
        `regexp_replace(mms."memberPhoneNumber", '\\D', '', 'g') LIKE :term`,
        { term: `%${term}%` },
      );
    }
    const [sql, parameters] = query.getQueryAndParameters();
    const rows = z.array(latestRow).parse(
      await this.mmsRepository.query(
        `SELECT * FROM (${sql}) latest
         ORDER BY latest."createdAt" DESC, latest.id DESC
         LIMIT ${params.limit + 1} OFFSET ${(params.page - 1) * params.limit}`,
        parameters,
      ),
    );
    const page = rows.slice(0, params.limit);
    const numbers = page.map((row) => row.phoneNumber);
    const [threads, members] = await Promise.all([
      this.threadRefs(numbers),
      this.membersByNumber(numbers),
    ]);
    return {
      threads: page.map((row, index) => ({
        thread: threads[index],
        members: members.get(row.phoneNumber) ?? [],
        lastMessageBody: row.body,
        lastMessageDirection: row.direction,
        lastMessageAt: row.createdAt,
      })),
      hasMore: rows.length > params.limit,
    };
  }

  /** BACKCOMPAT(mms-thread-rows): texts the previous release recorded may have
   * no row yet. Once this release is live everywhere, a migration inserting a
   * row for every number with an inbound or staff text lets this read rows
   * with findBy instead of upserting them. */
  private async threadRefs(phoneNumbers: string[]): Promise<ThreadRef[]> {
    const ids = await this.mmsNumberService.ensureThreads(phoneNumbers);
    return phoneNumbers.map((phoneNumber) => {
      const id = ids.get(phoneNumber);
      if (id === undefined) throw new Error("thread row missing after upsert");
      return { id, phoneNumber };
    });
  }

  /** Non-deleted members, by number. */
  async membersByNumber(
    phoneNumbers: string[],
  ): Promise<Map<string | null, User[]>> {
    if (phoneNumbers.length === 0) return new Map();
    const users = await this.userRepository
      .createQueryBuilder("member")
      .where('member."phoneNumber" = ANY(:phoneNumbers)', { phoneNumbers })
      .orderBy("member.id")
      .getMany();
    return Map.groupBy(users, (user) => user.phoneNumber);
  }

  /** Per number not opted out, its oldest inbound text that no staff reply has
   * followed and staff haven't marked handled, with the latest such text's
   * body as `lastMessageBody`. The window runs before `DISTINCT ON` keeps
   * each number's first row. */
  private async unansweredTexts() {
    const query = unanswered(this.mmsRepository.createQueryBuilder("inbound"))
      .select("inbound.id", "id")
      .addSelect('inbound."memberPhoneNumber"', "phoneNumber")
      .addSelect('inbound."createdAt"', "createdAt")
      .distinctOn(['inbound."memberPhoneNumber"'])
      .addSelect(
        `first_value(inbound.body) OVER (
          PARTITION BY inbound."memberPhoneNumber"
          ORDER BY inbound."createdAt" DESC, inbound.id DESC
        )`,
        "lastMessageBody",
      )
      .leftJoin(
        "mms_thread",
        "thread",
        'thread."phoneNumber" = inbound."memberPhoneNumber"',
      )
      .andWhere('inbound."handledEventId" IS NULL')
      .andWhere(
        `NOT ${optedOutSql({
          state: 'thread."optedOut"',
          phoneNumber: 'inbound."memberPhoneNumber"',
        })}`,
      )
      .orderBy('inbound."memberPhoneNumber"')
      .addOrderBy('inbound."createdAt"', "ASC")
      .addOrderBy("inbound.id", "ASC");
    return z.array(unansweredRow).parse(await query.getRawMany());
  }
}
