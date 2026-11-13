import { MigrationInterface, QueryRunner } from "typeorm";

export class CopyInboundMmsMedia1794380609618 implements MigrationInterface {
    name = 'CopyInboundMmsMedia1794380609618'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "mms_media" ("id" SERIAL NOT NULL, "mmsId" integer NOT NULL, "contentType" character varying NOT NULL, "twilioUrl" character varying NOT NULL, "twilioDeletedAt" TIMESTAMP WITH TIME ZONE, "twilioDeleteAttempts" integer NOT NULL DEFAULT '0', "lastTwilioDeleteAttemptAt" TIMESTAMP WITH TIME ZONE, "s3Key" character varying, "copyAttempts" integer NOT NULL DEFAULT '0', "lastCopyAttemptAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_4554b166b781fe9ec6069411834" PRIMARY KEY ("id")); COMMENT ON COLUMN "mms_media"."contentType" IS 'As Twilio reported it; not verified'; COMMENT ON COLUMN "mms_media"."twilioUrl" IS 'Twilio Media resource, deleted once copied to S3'; COMMENT ON COLUMN "mms_media"."twilioDeleteAttempts" IS 'Deletions Twilio refused'; COMMENT ON COLUMN "mms_media"."copyAttempts" IS 'Failed copies to S3'`);
        await queryRunner.query(`CREATE INDEX "IDX_94ff51137d49d5f9d86ffb89ba" ON "mms_media" ("mmsId") `);
        await queryRunner.query(`CREATE INDEX "IDX_424d89630ef85cdcca31339ebe" ON "mms_media" ("twilioDeleteAttempts", "id") WHERE "s3Key" IS NOT NULL AND "twilioDeletedAt" IS NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_772f0f811db7f3ded7179edac4" ON "mms_media" ("copyAttempts", "id") WHERE "s3Key" IS NULL`);
        await queryRunner.query(`ALTER TABLE "mms_media" ADD CONSTRAINT "FK_94ff51137d49d5f9d86ffb89baa" FOREIGN KEY ("mmsId") REFERENCES "mms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mms_media" DROP CONSTRAINT "FK_94ff51137d49d5f9d86ffb89baa"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_772f0f811db7f3ded7179edac4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_424d89630ef85cdcca31339ebe"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_94ff51137d49d5f9d86ffb89ba"`);
        await queryRunner.query(`DROP TABLE "mms_media"`);
    }

}
