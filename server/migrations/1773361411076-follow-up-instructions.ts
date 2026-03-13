import { MigrationInterface, QueryRunner } from "typeorm";

export class FollowUpInstructions1773361411076 implements MigrationInterface {
    name = 'FollowUpInstructions1773361411076'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "follow_up_form" ADD "instructions" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "follow_up_form" DROP COLUMN "instructions"`);
    }

}
