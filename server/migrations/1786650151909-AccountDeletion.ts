import { MigrationInterface, QueryRunner } from "typeorm";

export class AccountDeletion1786650151909 implements MigrationInterface {
    name = 'AccountDeletion1786650151909'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "message" DROP CONSTRAINT "FK_dc84d76f927b87f616cbedcf2e5"`);
        await queryRunner.query(`ALTER TABLE "action_authors_user" DROP CONSTRAINT "FK_7cdf718f68ee929831cb33791d5"`);
        await queryRunner.query(`ALTER TYPE "public"."event_log_event_enum" RENAME TO "event_log_event_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."event_log_event_enum" AS ENUM('account_created', 'contract_signed', 'contract_suspended', 'sms_unsubscribe', 'sms_resubscribe', 'sms_inbound', 'sms_failure', 'forum_action_autocomplete', 'action_comment', 'forum_reply_notif_failure', 'action_opt_out', 'account_deletion_requested', 'account_deleted')`);
        await queryRunner.query(`ALTER TABLE "event_log" ALTER COLUMN "event" TYPE "public"."event_log_event_enum" USING "event"::"text"::"public"."event_log_event_enum"`);
        await queryRunner.query(`DROP TYPE "public"."event_log_event_enum_old"`);
        await queryRunner.query(`ALTER TABLE "message" ADD CONSTRAINT "FK_dc84d76f927b87f616cbedcf2e5" FOREIGN KEY ("replyToId") REFERENCES "message"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "action_authors_user" ADD CONSTRAINT "FK_7cdf718f68ee929831cb33791d5" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_authors_user" DROP CONSTRAINT "FK_7cdf718f68ee929831cb33791d5"`);
        await queryRunner.query(`ALTER TABLE "message" DROP CONSTRAINT "FK_dc84d76f927b87f616cbedcf2e5"`);
        await queryRunner.query(`CREATE TYPE "public"."event_log_event_enum_old" AS ENUM('account_created', 'contract_signed', 'contract_suspended', 'sms_unsubscribe', 'sms_resubscribe', 'sms_inbound', 'sms_failure', 'forum_action_autocomplete', 'action_comment', 'forum_reply_notif_failure', 'action_opt_out', 'account_deletion_requested')`);
        await queryRunner.query(`ALTER TABLE "event_log" ALTER COLUMN "event" TYPE "public"."event_log_event_enum_old" USING "event"::"text"::"public"."event_log_event_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."event_log_event_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."event_log_event_enum_old" RENAME TO "event_log_event_enum"`);
        await queryRunner.query(`ALTER TABLE "action_authors_user" ADD CONSTRAINT "FK_7cdf718f68ee929831cb33791d5" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "message" ADD CONSTRAINT "FK_dc84d76f927b87f616cbedcf2e5" FOREIGN KEY ("replyToId") REFERENCES "message"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
