import { MigrationInterface, QueryRunner } from "typeorm";

export class RemovePaymentData1789493200736 implements MigrationInterface {
    name = 'RemovePaymentData1789493200736'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "UQ_0bfe583759eb0305b60117be840"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "stripeCustomerId"`);
        await queryRunner.query(`DROP TABLE "payment_user_data_token"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "payment_user_data_token" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "paymentIntentId" character varying, "firstName" character varying, "lastName" character varying, "email" character varying, CONSTRAINT "PK_eaab4debcd7e6acae65bd330dd9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "user" ADD "stripeCustomerId" character varying`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "UQ_0bfe583759eb0305b60117be840" UNIQUE ("stripeCustomerId")`);
    }

}
