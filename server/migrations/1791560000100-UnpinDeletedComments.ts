import { MigrationInterface, QueryRunner } from "typeorm";

export class UnpinDeletedComments1791560000100 implements MigrationInterface {
    name = 'UnpinDeletedComments1791560000100'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "comment" SET "pinned" = false WHERE "deleted" AND "pinned"`);
    }

    public async down(): Promise<void> {}

}
