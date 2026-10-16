import { MigrationInterface, QueryRunner } from "typeorm";

export class ContractReminderSentAt1792141515694 implements MigrationInterface {
    name = 'ContractReminderSentAt1792141515694'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "contractReminderSentAt" TIMESTAMP WITH TIME ZONE`);
        // Every mail row counts, failed and soft-deleted included, as the worker counted them.
        await queryRunner.query(`
            UPDATE "user" SET "contractReminderSentAt" = reminded."sentAt"
            FROM (
                SELECT "to", MIN("createdAt") AS "sentAt" FROM "mail"
                WHERE "emailType" = 'contract_reminder'
                GROUP BY "to"
            ) reminded
            WHERE reminded."to" = "user"."email"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "contractReminderSentAt"`);
    }

}
