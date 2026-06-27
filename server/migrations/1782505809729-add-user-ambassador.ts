import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserAmbassador1782505809729 implements MigrationInterface {
    name = 'AddUserAmbassador1782505809729'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "ambassador" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "ambassador"`);
    }

}
