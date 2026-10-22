import { MigrationInterface, QueryRunner } from "typeorm";

export class WaitlistNonprofitNominations1792040996877 implements MigrationInterface {
    name = 'WaitlistNonprofitNominations1792040996877'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "waitlist_entry" ADD "nonprofitNominations" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "waitlist_entry" DROP COLUMN "nonprofitNominations"`);
    }

}
