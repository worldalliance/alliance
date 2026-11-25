import { MigrationInterface, QueryRunner } from "typeorm";

export class WaitlistRecipientAttemptId1794894080414 implements MigrationInterface {
    name = 'WaitlistRecipientAttemptId1794894080414'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "waitlist_email_recipient" ADD "attemptId" uuid`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "waitlist_email_recipient" DROP COLUMN "attemptId"`);
    }

}
