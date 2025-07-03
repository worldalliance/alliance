import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameUpdateDate1751578845535 implements MigrationInterface {
    name = 'RenameUpdateDate1751578845535'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_event" RENAME COLUMN "updateDate" TO "updatedAt"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_event" RENAME COLUMN "updatedAt" TO "updateDate"`);
    }

}
