import { MigrationInterface, QueryRunner } from "typeorm";

export class CommentThreadIndexes1791896000000 implements MigrationInterface {
    name = 'CommentThreadIndexes1791896000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_e3aebe2bd1c53467a07109be59" ON "comment" ("parentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_276779da446413a0d79598d4fb" ON "comment" ("authorId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7f0abfa7863205a85cdc5b52c9" ON "user" ("id") WHERE "deletedAt" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_7f0abfa7863205a85cdc5b52c9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_276779da446413a0d79598d4fb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e3aebe2bd1c53467a07109be59"`);
    }

}
