import { MigrationInterface, QueryRunner } from "typeorm";

export class NotificationPreferenceNewAccountSource1792698415431 implements MigrationInterface {
    name = 'NotificationPreferenceNewAccountSource1792698415431'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."notification_preference_source_enum" RENAME TO "notification_preference_source_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."notification_preference_source_enum" AS ENUM('member', 'migrated', 'new_account')`);
        await queryRunner.query(`ALTER TABLE "notification_preference" ALTER COLUMN "source" TYPE "public"."notification_preference_source_enum" USING "source"::"text"::"public"."notification_preference_source_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notification_preference_source_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."notification_preference_source_enum_old" AS ENUM('member', 'migrated')`);
        await queryRunner.query(`ALTER TABLE "notification_preference" ALTER COLUMN "source" TYPE "public"."notification_preference_source_enum_old" USING "source"::"text"::"public"."notification_preference_source_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."notification_preference_source_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."notification_preference_source_enum_old" RENAME TO "notification_preference_source_enum"`);
    }

}
