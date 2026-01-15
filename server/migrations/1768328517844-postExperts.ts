import { MigrationInterface, QueryRunner } from "typeorm";

export class PostExperts1768328517844 implements MigrationInterface {
    name = 'PostExperts1768328517844'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "post_experts_user" ("postId" integer NOT NULL, "userId" integer NOT NULL, CONSTRAINT "PK_d0e928113e6b5df44806b2cd65c" PRIMARY KEY ("postId", "userId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8b55d6247fb7ce805226f712a8" ON "post_experts_user" ("postId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1527bfc5c1820d47e29461957a" ON "post_experts_user" ("userId") `);
        await queryRunner.query(`ALTER TABLE "post" ADD "qaMode" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "post" ADD "expertLabel" character varying`);
        await queryRunner.query(`ALTER TABLE "post_experts_user" ADD CONSTRAINT "FK_8b55d6247fb7ce805226f712a89" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "post_experts_user" ADD CONSTRAINT "FK_1527bfc5c1820d47e29461957a8" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post_experts_user" DROP CONSTRAINT "FK_1527bfc5c1820d47e29461957a8"`);
        await queryRunner.query(`ALTER TABLE "post_experts_user" DROP CONSTRAINT "FK_8b55d6247fb7ce805226f712a89"`);
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "expertLabel"`);
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "qaMode"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1527bfc5c1820d47e29461957a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8b55d6247fb7ce805226f712a8"`);
        await queryRunner.query(`DROP TABLE "post_experts_user"`);
    }

}
