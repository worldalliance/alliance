import { MigrationInterface, QueryRunner } from "typeorm";

export class LegacyLinkOpenings1791319800000 implements MigrationInterface {
    name = 'LegacyLinkOpenings1791319800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "message_tracking" ADD "legacy" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TYPE "public"."message_tracking_channel_enum" RENAME TO "message_tracking_channel_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."message_tracking_channel_enum" AS ENUM('email', 'sms', 'unknown')`);
        await queryRunner.query(`ALTER TABLE "message_tracking" ALTER COLUMN "channel" TYPE "public"."message_tracking_channel_enum" USING "channel"::"text"::"public"."message_tracking_channel_enum"`);
        await queryRunner.query(`DROP TYPE "public"."message_tracking_channel_enum_old"`);
        await queryRunner.query(`ALTER TABLE "link_opening" ALTER COLUMN "messageTrackingId" DROP NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_1cc8c94c7b59b4636eb0fb83d2" ON "notification" ("cid") WHERE "cid" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_1b9d048942e032c7a2c3a61c0a" ON "action_update_exposure" ("cid") WHERE "cid" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_1b9d048942e032c7a2c3a61c0a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1cc8c94c7b59b4636eb0fb83d2"`);
        await queryRunner.query(`ALTER TABLE "link_opening" ALTER COLUMN "messageTrackingId" SET NOT NULL`);
        await queryRunner.query(`CREATE TYPE "public"."message_tracking_channel_enum_old" AS ENUM('email', 'sms')`);
        await queryRunner.query(`ALTER TABLE "message_tracking" ALTER COLUMN "channel" TYPE "public"."message_tracking_channel_enum_old" USING "channel"::"text"::"public"."message_tracking_channel_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."message_tracking_channel_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."message_tracking_channel_enum_old" RENAME TO "message_tracking_channel_enum"`);
        await queryRunner.query(`ALTER TABLE "message_tracking" DROP COLUMN "legacy"`);
    }

}
