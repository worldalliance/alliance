import { MigrationInterface, QueryRunner } from "typeorm";

export class CommentThreadIndexes1791560000200 implements MigrationInterface {
    name = 'CommentThreadIndexes1791560000200'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_e3aebe2bd1c53467a07109be59" ON "comment" ("parentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_276779da446413a0d79598d4fb" ON "comment" ("authorId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_276779da446413a0d79598d4fb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e3aebe2bd1c53467a07109be59"`);
    }

}
