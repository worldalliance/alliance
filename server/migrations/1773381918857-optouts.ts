import { MigrationInterface, QueryRunner } from 'typeorm';

export class Optouts1773381918857 implements MigrationInterface {
  name = 'Optouts1773381918857';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."event_log_event_enum" ADD VALUE 'action_opt_out'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."event_log_event_enum_old" AS ENUM('account_created', 'contract_signed', 'contract_suspended', 'sms_unsubscribe', 'sms_inbound', 'sms_failure', 'forum_action_autocomplete', 'action_comment', 'forum_reply_notif_failure')`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_log" ALTER COLUMN "event" TYPE "public"."event_log_event_enum_old" USING "event"::"text"::"public"."event_log_event_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."event_log_event_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."event_log_event_enum_old" RENAME TO "event_log_event_enum"`,
    );
  }
}
