import { MigrationInterface, QueryRunner } from "typeorm";

export class WaitlistLinkReferralMessage1791497416911 implements MigrationInterface {
    name = 'WaitlistLinkReferralMessage1791497416911'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "waitlist_link" ADD "showReferralMessage" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "waitlist_link" DROP COLUMN "showReferralMessage"`);
    }

}
