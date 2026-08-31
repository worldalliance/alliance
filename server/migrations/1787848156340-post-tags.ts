import { MigrationInterface, QueryRunner } from "typeorm";

export class PostTags1787848156340 implements MigrationInterface {
    name = 'PostTags1787848156340'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "post_tag" ("id" SERIAL NOT NULL, "postId" integer NOT NULL, "name" character varying NOT NULL, "sortOrder" integer NOT NULL DEFAULT '0', CONSTRAINT "UQ_5a3b3ec40482829ef5537f7e87f" UNIQUE ("postId", "name") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "PK_3364a9669ea4b632cff0eb01944" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "comment" ADD "tagId" integer`);
        await queryRunner.query(`ALTER TABLE "post_tag" ADD CONSTRAINT "FK_444c1b4f6cd7b632277f5579354" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comment" ADD CONSTRAINT "FK_b745509a74961659133c586b3b0" FOREIGN KEY ("tagId") REFERENCES "post_tag"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "FK_b745509a74961659133c586b3b0"`);
        await queryRunner.query(`ALTER TABLE "post_tag" DROP CONSTRAINT "FK_444c1b4f6cd7b632277f5579354"`);
        await queryRunner.query(`ALTER TABLE "comment" DROP COLUMN "tagId"`);
        await queryRunner.query(`DROP TABLE "post_tag"`);
    }

}
