import { MigrationInterface, QueryRunner } from "typeorm";

export class Actionstatusenum1751678120378 implements MigrationInterface {
    name = 'Actionstatusenum1751678120378'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_event" DROP COLUMN "newStatus"`);
        await queryRunner.query(`CREATE TYPE "public"."action_event_newstatus_enum" AS ENUM('draft', 'upcoming', 'gathering_commitments', 'commitments_reached', 'member_action', 'resolution', 'completed', 'failed', 'abandoned')`);
        await queryRunner.query(`ALTER TABLE "action_event" ADD "newStatus" "public"."action_event_newstatus_enum" NOT NULL DEFAULT 'draft'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_event" DROP COLUMN "newStatus"`);
        await queryRunner.query(`DROP TYPE "public"."action_event_newstatus_enum"`);
        await queryRunner.query(`ALTER TABLE "action_event" ADD "newStatus" character varying NOT NULL`);
    }

}
