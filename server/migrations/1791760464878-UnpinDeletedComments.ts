import { MigrationInterface, QueryRunner } from "typeorm";

export class UnpinDeletedComments1791760464878 implements MigrationInterface {
    name = 'UnpinDeletedComments1791760464878'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "comment" SET "pinned" = false WHERE "deleted" AND "pinned"`);
    }

    public async down(): Promise<void> {}

}
