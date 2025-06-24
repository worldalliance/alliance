import { MigrationInterface, QueryRunner } from "typeorm";

export class PartialProfiles1750802129511 implements MigrationInterface {
    name = 'PartialProfiles1750802129511'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "payment_user_data_token" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "paymentIntentId" character varying, "firstName" character varying, "lastName" character varying, "email" character varying, CONSTRAINT "PK_eaab4debcd7e6acae65bd330dd9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "user" ADD "isNotSignedUpPartialProfile" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isNotSignedUpPartialProfile"`);
        await queryRunner.query(`DROP TABLE "payment_user_data_token"`);
    }

}
