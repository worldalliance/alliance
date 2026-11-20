import type { EntityManager } from "typeorm";
import { z } from "zod";
import { MmsThread } from "./mms-thread.entity";

/** BACKCOMPAT(number-opt-out): the number is also opted out while any user
 * with it, deleted ones included, has the old flag, so a keyword the previous
 * release handled still counts. Drop the flag check, and the user index it
 * reads, once no running release writes the flag without the state and every
 * number a user holds has a non-null state. Takes SQL
 * expressions for the thread row's `optedOut` and the number. */
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
