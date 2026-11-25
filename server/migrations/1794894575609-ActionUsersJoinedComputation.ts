import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionUsersJoinedComputation1794894575609 implements MigrationInterface {
    name = 'ActionUsersJoinedComputation1794894575609'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" ADD "usersJoinedComputation" BIGSERIAL NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "usersJoinedComputation"`);
    }

}
