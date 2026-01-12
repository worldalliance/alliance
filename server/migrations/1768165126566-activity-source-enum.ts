import { MigrationInterface, QueryRunner } from "typeorm";

export class ActivitySourceEnum1768165126566 implements MigrationInterface {
    name = 'ActivitySourceEnum1768165126566'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."action_activity_source_enum" AS ENUM('user', 'admin_override')`);
        await queryRunner.query(`ALTER TABLE "action_activity" ADD "source" "public"."action_activity_source_enum" NOT NULL DEFAULT 'user'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_activity" DROP COLUMN "source"`);
        await queryRunner.query(`DROP TYPE "public"."action_activity_source_enum"`);
    }

}
