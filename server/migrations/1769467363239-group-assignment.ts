import { MigrationInterface, QueryRunner } from "typeorm";

export class GroupAssignment1769467363239 implements MigrationInterface {
    name = 'GroupAssignment1769467363239'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "undergoingGroupAssignment" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "undergoingGroupAssignment"`);
    }

}
