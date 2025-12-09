import { MigrationInterface, QueryRunner } from "typeorm";

export class Plannedstate1765229288270 implements MigrationInterface {
    name = 'Plannedstate1765229288270'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_6e446b5ec2f5b912fb6bfa1426"`);
        await queryRunner.query(`ALTER TYPE "public"."action_event_newstatus_enum" RENAME TO "action_event_newstatus_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."action_event_newstatus_enum" AS ENUM('draft', 'planned', 'gathering_commitments', 'office_action', 'member_action', 'resolution', 'completed', 'failed', 'abandoned')`);
        await queryRunner.query(`ALTER TABLE "action_event" ALTER COLUMN "newStatus" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "action_event" ALTER COLUMN "newStatus" TYPE "public"."action_event_newstatus_enum" USING "newStatus"::"text"::"public"."action_event_newstatus_enum"`);
        await queryRunner.query(`ALTER TABLE "action_event" ALTER COLUMN "newStatus" SET DEFAULT 'draft'`);
        await queryRunner.query(`DROP TYPE "public"."action_event_newstatus_enum_old"`);
        await queryRunner.query(`CREATE INDEX "IDX_6e446b5ec2f5b912fb6bfa1426" ON "action_event" ("actionId", "newStatus", "date") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_6e446b5ec2f5b912fb6bfa1426"`);
        await queryRunner.query(`CREATE TYPE "public"."action_event_newstatus_enum_old" AS ENUM('draft', 'upcoming', 'gathering_commitments', 'office_action', 'member_action', 'resolution', 'completed', 'failed', 'abandoned')`);
        await queryRunner.query(`ALTER TABLE "action_event" ALTER COLUMN "newStatus" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "action_event" ALTER COLUMN "newStatus" TYPE "public"."action_event_newstatus_enum_old" USING "newStatus"::"text"::"public"."action_event_newstatus_enum_old"`);
        await queryRunner.query(`ALTER TABLE "action_event" ALTER COLUMN "newStatus" SET DEFAULT 'draft'`);
        await queryRunner.query(`DROP TYPE "public"."action_event_newstatus_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."action_event_newstatus_enum_old" RENAME TO "action_event_newstatus_enum"`);
        await queryRunner.query(`CREATE INDEX "IDX_6e446b5ec2f5b912fb6bfa1426" ON "action_event" ("newStatus", "date", "actionId") `);
    }

}
