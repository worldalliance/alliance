import { MigrationInterface, QueryRunner } from "typeorm";

export class WaitlistReasonOptional1791422971421 implements MigrationInterface {
    name = 'WaitlistReasonOptional1791422971421'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "waitlist_entry" DROP CONSTRAINT "CHK_waitlist_entry_reason"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "waitlist_entry" ADD CONSTRAINT "CHK_waitlist_entry_reason" CHECK ((("organizationId" IS NOT NULL) OR (COALESCE(reason, ''::text) ~ '[^[:space:]]'::text)))`);
    }

}
