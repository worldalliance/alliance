import { MigrationInterface, QueryRunner } from "typeorm";

export class WaitlistMarkUnsubscribed1791321356844 implements MigrationInterface {
    name = 'WaitlistMarkUnsubscribed1791321356844'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."waitlist_entry_action_kind_enum" RENAME TO "waitlist_entry_action_kind_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."waitlist_entry_action_kind_enum" AS ENUM('manual_mobilize', 'undo_mobilize', 'email_mobilize', 'mark_spam', 'mark_not_spam', 'mark_unsubscribed')`);
        await queryRunner.query(`ALTER TABLE "waitlist_entry_action" ALTER COLUMN "kind" TYPE "public"."waitlist_entry_action_kind_enum" USING "kind"::"text"::"public"."waitlist_entry_action_kind_enum"`);
        await queryRunner.query(`DROP TYPE "public"."waitlist_entry_action_kind_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."waitlist_entry_action_kind_enum_old" AS ENUM('manual_mobilize', 'undo_mobilize', 'email_mobilize', 'mark_spam', 'mark_not_spam')`);
        await queryRunner.query(`ALTER TABLE "waitlist_entry_action" ALTER COLUMN "kind" TYPE "public"."waitlist_entry_action_kind_enum_old" USING "kind"::"text"::"public"."waitlist_entry_action_kind_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."waitlist_entry_action_kind_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."waitlist_entry_action_kind_enum_old" RENAME TO "waitlist_entry_action_kind_enum"`);
    }

}
