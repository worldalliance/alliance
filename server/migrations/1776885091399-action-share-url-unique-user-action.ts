import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionShareUrlUniqueUserAction1776885091399 implements MigrationInterface {
    name = 'ActionShareUrlUniqueUserAction1776885091399'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM "action_share_url" a
            USING "action_share_url" b
            WHERE a."actionId" = b."actionId"
              AND a."userId" = b."userId"
              AND (a."createdAt", a."id") > (b."createdAt", b."id")
        `);
        await queryRunner.query(`ALTER TABLE "action_share_url" ADD CONSTRAINT "UQ_536fac0e161e3f8708b44a7ca76" UNIQUE ("actionId", "userId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_share_url" DROP CONSTRAINT "UQ_536fac0e161e3f8708b44a7ca76"`);
    }

}
