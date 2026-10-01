import { MigrationInterface, QueryRunner } from "typeorm";

export class WaitlistUnsubscribeToken1790798548139 implements MigrationInterface {
    name = 'WaitlistUnsubscribeToken1790798548139'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "waitlist_entry" ADD "unsubscribeToken" uuid NOT NULL DEFAULT uuid_generate_v4()`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_d840068dd565143e6f0ffb444d" ON "waitlist_entry" ("unsubscribeToken") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_d840068dd565143e6f0ffb444d"`);
        await queryRunner.query(`ALTER TABLE "waitlist_entry" DROP COLUMN "unsubscribeToken"`);
    }

}
