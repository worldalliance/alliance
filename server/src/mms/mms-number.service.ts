import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "src/utils/Repository";
import { type EntityManager, In } from "typeorm";
import { z } from "zod";
import { MmsThread } from "./mms-thread.entity";

/** BACKCOMPAT(number-opt-out): the number is also opted out while any user
 * with it, deleted ones included, has the old flag, so a keyword the previous
 * release handled still counts. Drop the flag check, and the user index it
 * reads, once no running release writes the flag without the state and every
 * number a user holds has a non-null state. Takes SQL expressions for the
 * number, which may come from `mms` since a text the previous release
 * recorded has no thread row, and for that row's `optedOut`. */
export const optedOutSql = (params: { state: string; phoneNumber: string }) =>
  `((${params.state}) IS TRUE OR EXISTS (
    SELECT 1 FROM "user" flagged
    WHERE flagged."phoneNumber" = ${params.phoneNumber}
      AND flagged."phoneNumberUnsubscribed"
  ))`;

export async function numberOptedOut(
  manager: EntityManager,
  phoneNumber: string,
): Promise<boolean> {
  const rows: unknown = await manager.query(
    `SELECT ${optedOutSql({
      state: '(SELECT "optedOut" FROM mms_thread WHERE "phoneNumber" = $1)',
      phoneNumber: "$1",
    })} AS "optedOut"`,
    [phoneNumber],
  );
  return z.tuple([z.object({ optedOut: z.boolean() })]).parse(rows)[0].optedOut;
}

export async function setNumberOptedOut(
  manager: EntityManager,
  params: { phoneNumber: string; optedOut: boolean },
): Promise<void> {
  await manager
    .createQueryBuilder()
    .insert()
    .into(MmsThread)
    .values(params)
    .orUpdate(["optedOut"], ["phoneNumber"])
    .execute();
}

/** BACKCOMPAT(number-opt-out): a member's flag may be the only record of their
 * number's STOP. Records it on the number they leave and returns the flag they
 * take to `to`. `from` must be read under the member's row lock, which orders
 * this write against a STOP or START on the number they leave. Remove with
 * optedOutSql's flag check. */
export async function moveNumberOptOut(
  manager: EntityManager,
  params: {
    from: { phoneNumber: string | null; phoneNumberUnsubscribed: boolean };
    to: string | null;
  },
): Promise<boolean> {
  const { from, to } = params;
  if (
    from.phoneNumber &&
    from.phoneNumber !== to &&
    from.phoneNumberUnsubscribed
  ) {
    await setNumberOptedOut(manager, {
      phoneNumber: from.phoneNumber,
      optedOut: true,
    });
  }
  return to === null ? false : numberOptedOut(manager, to);
}

@Injectable()
export class MmsNumberService {
  constructor(
    @InjectRepository(MmsThread)
    private readonly threadRepository: Repository<MmsThread>,
  ) {}

  /** The number's thread id, creating its row if it has none. */
  async ensureThread(
    phoneNumber: string,
    manager: EntityManager = this.threadRepository.manager,
  ): Promise<string> {
    // The update, which also touches updatedAt, makes RETURNING yield the row
    // when it already exists.
    const result = await manager
      .createQueryBuilder()
      .insert()
      .into(MmsThread)
      .values({ phoneNumber })
      .orUpdate(["phoneNumber"], ["phoneNumber"])
      .returning(["id"])
      .execute();
    return z.object({ id: z.string() }).parse(result.raw[0]).id;
  }

  /** Thread ids by number, creating the rows of numbers that have none.
   * BACKCOMPAT(mms-thread-rows): see MmsInboxService.threadRefs. */
  async ensureThreads(phoneNumbers: string[]): Promise<Map<string, string>> {
    if (phoneNumbers.length === 0) return new Map();
    await this.threadRepository
      .createQueryBuilder()
      .insert()
      .into(MmsThread)
      // Sorted so concurrent inserts of the same missing rows can't deadlock.
      .values(phoneNumbers.toSorted().map((phoneNumber) => ({ phoneNumber })))
      .orIgnore()
      .execute();
    const threads = await this.threadRepository.findBy({
      phoneNumber: In(phoneNumbers),
    });
    return new Map(threads.map((t) => [t.phoneNumber, t.id]));
  }

  async optedOut(phoneNumber: string): Promise<boolean> {
    return numberOptedOut(this.threadRepository.manager, phoneNumber);
  }
}
