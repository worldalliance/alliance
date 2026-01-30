import { MigrationInterface, QueryRunner } from "typeorm";

export class PriorityNotifs1769639546392 implements MigrationInterface {
    name = 'PriorityNotifs1769639546392'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."notification_priority_enum" AS ENUM('low', 'high')`);
        await queryRunner.query(`ALTER TABLE "notification" ADD "priority" "public"."notification_priority_enum" NOT NULL DEFAULT 'low'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification" DROP COLUMN "priority"`);
        await queryRunner.query(`DROP TYPE "public"."notification_priority_enum"`);
    }

}
