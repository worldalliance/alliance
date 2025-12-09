import { MigrationInterface, QueryRunner } from "typeorm";

export class ActivityIndex1764971261360 implements MigrationInterface {
    name = 'ActivityIndex1764971261360'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_action_activity_type_createdAt" ON "action_activity" ("type", "createdAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_action_activity_type_createdAt"`);
    }

}
