import { parsePhoneNumberWithError } from 'libphonenumber-js/max';
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Kept local so later app changes cannot alter migration behavior. */
function parseE164(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  try {
    // Interpret unqualified legacy numbers as US.
    const parsed = parsePhoneNumberWithError(trimmed, 'US');
    return parsed.isValid() ? parsed.number : null;
  } catch {
    return null;
  }
}

export class NormalizePhoneNumbers1785351516457 implements MigrationInterface {
  name = 'NormalizePhoneNumbers1785351516457';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // A 2026-07-29 production export fit these rules: user NULL/blank becomes
    // NULL, while Twilio sender identifiers in mms.from remain untouched.
    const targets = [
      {
        table: 'user',
        column: 'phoneNumber',
        idType: 'int',
        firstId: 0,
        clearUnparseable: true,
      },
      {
        // This migration assumes mms.to rows are outbound phone numbers. Keep
        // runtime storage opaque so future Twilio recipient types round-trip.
        table: 'mms',
        column: 'to',
        idType: 'int',
        firstId: 0,
        clearUnparseable: false,
      },
      {
        table: 'mms_optout',
        column: 'phoneNumber',
        idType: 'uuid',
        firstId: '00000000-0000-0000-0000-000000000000',
        clearUnparseable: false,
      },
    ] as const;

    const pageSize = 1000;

    for (const {
      table,
      column,
      idType,
      firstId,
      clearUnparseable,
    } of targets) {
      let normalized = 0;
      let cleared = 0;
      let unparseable = 0;
      let afterId: number | string = firstId;

      for (;;) {
        const page = (await queryRunner.query(
          `SELECT "id", "${column}" AS value FROM "${table}"
           WHERE "id" > $1::${idType} AND "${column}" IS NOT NULL
           ORDER BY "id" LIMIT ${pageSize}`,
          [afterId],
        )) as Array<{ id: number | string; value: string }>;

        if (page.length === 0) {
          break;
        }
        afterId = page[page.length - 1]!.id;

        const changes: Array<{
          id: number | string;
          value: string | null;
        }> = [];
        for (const row of page) {
          const e164 = parseE164(row.value);
          if (e164 === null) {
            if (clearUnparseable) {
              changes.push({ id: row.id, value: null });
              cleared++;
            } else {
              unparseable++;
            }
          } else if (e164 !== row.value) {
            changes.push({ id: row.id, value: e164 });
            normalized++;
          }
        }

        if (changes.length > 0) {
          const tuples = changes
            .map((_, i) => `($${i * 2 + 1}::${idType}, $${i * 2 + 2}::text)`)
            .join(', ');
          await queryRunner.query(
            `UPDATE "${table}" AS t SET "${column}" = v.value
             FROM (VALUES ${tuples}) AS v(id, value) WHERE t."id" = v.id`,
            changes.flatMap((c) => [c.id, c.value]),
          );
        }
      }

      console.log(
        `normalize-phone-numbers: ${table}."${column}" — ${normalized} row(s) normalized, ${cleared} invalid row(s) cleared, ${unparseable} left as-is (not parseable)`,
      );
    }

    const [duplicates] = (await queryRunner.query(
      `SELECT count(*)::int AS numbers, coalesce(sum(rows), 0)::int AS rows
       FROM (
         SELECT count(*) AS rows FROM "user"
         WHERE "phoneNumber" IS NOT NULL AND trim("phoneNumber") <> ''
         GROUP BY "phoneNumber" HAVING count(*) > 1
       ) shared`,
    )) as Array<{ numbers: number; rows: number }>;

    console.log(
      duplicates.numbers === 0
        ? `normalize-phone-numbers: "user"."phoneNumber" — no number is shared by more than one row`
        : `normalize-phone-numbers: "user"."phoneNumber" — ${duplicates.numbers} number(s) now shared by ${duplicates.rows} row(s); a lookup by number resolves to one of them arbitrarily`,
    );

    await queryRunner.query(
      `COMMENT ON COLUMN "mms"."to" IS 'Twilio recipient address; may be E.164, a short code, or a channel address'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "mms"."from" IS 'Twilio sender identifier; may be E.164, a short code, or alphanumeric'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "user"."phoneNumber" IS 'E.164 format (+15551234567)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "mms_optout"."phoneNumber" IS 'E.164 format (+15551234567)'`,
    );

    await queryRunner.query(
      `ALTER TYPE "public"."event_log_event_enum" RENAME TO "event_log_event_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."event_log_event_enum" AS ENUM('account_created', 'contract_signed', 'contract_suspended', 'sms_unsubscribe', 'sms_resubscribe', 'sms_inbound', 'sms_failure', 'forum_action_autocomplete', 'action_comment', 'forum_reply_notif_failure', 'action_opt_out', 'account_deletion_requested')`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_log" ALTER COLUMN "event" TYPE "public"."event_log_event_enum" USING "event"::"text"::"public"."event_log_event_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."event_log_event_enum_old"`);

    // Canonical storage replaces the parse-only validation flag.
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "phoneNumberValidated"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "phoneNumberValidated" boolean NOT NULL DEFAULT false`,
    );

    // Fails if any row uses 'sms_resubscribe'.
    await queryRunner.query(
      `CREATE TYPE "public"."event_log_event_enum_old" AS ENUM('account_created', 'contract_signed', 'contract_suspended', 'sms_unsubscribe', 'sms_inbound', 'sms_failure', 'forum_action_autocomplete', 'action_comment', 'forum_reply_notif_failure', 'action_opt_out', 'account_deletion_requested')`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_log" ALTER COLUMN "event" TYPE "public"."event_log_event_enum_old" USING "event"::"text"::"public"."event_log_event_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."event_log_event_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."event_log_event_enum_old" RENAME TO "event_log_event_enum"`,
    );

    // Original formatting cannot be restored; remove only column comments.
    await queryRunner.query(
      `COMMENT ON COLUMN "mms_optout"."phoneNumber" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "user"."phoneNumber" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "mms"."from" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "mms"."to" IS NULL`);
  }
}
