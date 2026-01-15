import { MigrationInterface, QueryRunner } from "typeorm";

export class TagIndices1768504999853 implements MigrationInterface {
    name = 'TagIndices1768504999853'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_ac2dc02851d77738e7aba2782f" ON "tag_users_user" ("tagId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b0a20bd6ef1b97861a20e194b9" ON "tag_participating_in_action" ("tagId") `);
        await queryRunner.query(`CREATE INDEX "IDX_488f25c6897226813db2de109e" ON "action_participating_tags_tag" ("tagId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_488f25c6897226813db2de109e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b0a20bd6ef1b97861a20e194b9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ac2dc02851d77738e7aba2782f"`);
    }

}
