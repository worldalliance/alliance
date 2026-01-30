import { MigrationInterface, QueryRunner } from "typeorm";

export class MultiplePostAuthors1769642223093 implements MigrationInterface {
    name = 'MultiplePostAuthors1769642223093'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "post_authors_user" ("postId" integer NOT NULL, "userId" integer NOT NULL, CONSTRAINT "PK_04a9cea1a823a059cdefb41d1b1" PRIMARY KEY ("postId", "userId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fecb124dd2fb002ffb157fb158" ON "post_authors_user" ("postId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0a3ecfe10aed060b0e00e2bf31" ON "post_authors_user" ("userId") `);
        await queryRunner.query(`ALTER TABLE "post_authors_user" ADD CONSTRAINT "FK_fecb124dd2fb002ffb157fb158e" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "post_authors_user" ADD CONSTRAINT "FK_0a3ecfe10aed060b0e00e2bf318" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`INSERT INTO "post_authors_user" ("postId", "userId") SELECT "id", "authorId" FROM "post" WHERE "authorId" IS NOT NULL ON CONFLICT DO NOTHING`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post_authors_user" DROP CONSTRAINT "FK_0a3ecfe10aed060b0e00e2bf318"`);
        await queryRunner.query(`ALTER TABLE "post_authors_user" DROP CONSTRAINT "FK_fecb124dd2fb002ffb157fb158e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0a3ecfe10aed060b0e00e2bf31"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fecb124dd2fb002ffb157fb158"`);
        await queryRunner.query(`DROP TABLE "post_authors_user"`);
    }

}
