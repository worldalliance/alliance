import { MigrationInterface, QueryRunner } from "typeorm";

export class IndexMemberThreads1794380851234 implements MigrationInterface {
    name = 'IndexMemberThreads1794380851234'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_83378ecc36c0435f9f70daf606" ON "mms" ("memberPhoneNumber", "createdAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_83378ecc36c0435f9f70daf606"`);
    }

}
