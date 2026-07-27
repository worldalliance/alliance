import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionActivityUserTypeIndex1785183466630 implements MigrationInterface {
    name = 'ActionActivityUserTypeIndex1785183466630'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_action_activity_user_type" ON "action_activity" ("userId", "type") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_action_activity_user_type"`);
    }

}
