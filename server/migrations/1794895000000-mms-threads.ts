import { MigrationInterface, QueryRunner } from "typeorm";

export class MmsThreads1794895000000 implements MigrationInterface {
    name = 'MmsThreads1794895000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "mms_thread" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "phoneNumber" character varying NOT NULL, "optedOut" boolean, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_dda5d7b2a2dbb3b41123095cfc6" UNIQUE ("phoneNumber"), CONSTRAINT "PK_ff9e2b4f7421c115873a410aabf" PRIMARY KEY ("id")); COMMENT ON COLUMN "mms_thread"."phoneNumber" IS 'As mms.memberPhoneNumber holds it, so it may be a short code'`);
        await queryRunner.query(`ALTER TABLE "mms_optout" ALTER COLUMN "userId" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "mms_optout" WHERE "userId" IS NULL`);
        await queryRunner.query(`ALTER TABLE "mms_optout" ALTER COLUMN "userId" SET NOT NULL`);
        await queryRunner.query(`DROP TABLE "mms_thread"`);
    }

}
