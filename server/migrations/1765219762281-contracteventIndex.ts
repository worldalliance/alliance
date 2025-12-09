import { MigrationInterface, QueryRunner } from "typeorm";

export class ContracteventIndex1765219762281 implements MigrationInterface {
    name = 'ContracteventIndex1765219762281'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_570a9fcca47e3eb48546536d7f" ON "contract_event" ("userId", "date") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_570a9fcca47e3eb48546536d7f"`);
    }

}
