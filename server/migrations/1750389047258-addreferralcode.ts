import { MigrationInterface, QueryRunner } from "typeorm";

export class Addreferralcode1750389047258 implements MigrationInterface {
    name = 'Addreferralcode1750389047258'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "referralCode" character varying`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "UQ_bf0e513b5cd8b4e937fa0702311" UNIQUE ("referralCode")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "UQ_bf0e513b5cd8b4e937fa0702311"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "referralCode"`);
    }

}
