import { MigrationInterface, QueryRunner } from "typeorm";

export class NewThresholdfields1751487010451 implements MigrationInterface {
    name = 'NewThresholdfields1751487010451'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."action_status_enum"`);
        await queryRunner.query(`ALTER TABLE "action" ADD "commitmentLaunchTime" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "action" ADD "completionLaunchTime" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "completionLaunchTime"`);
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "commitmentLaunchTime"`);
        await queryRunner.query(`CREATE TYPE "public"."action_status_enum" AS ENUM('draft', 'upcoming', 'gathering-commitments', 'commitments-reached', 'member-action', 'resolution', 'completed', 'failed', 'abandoned')`);
        await queryRunner.query(`ALTER TABLE "action" ADD "status" "public"."action_status_enum" NOT NULL DEFAULT 'draft'`);
    }

}
