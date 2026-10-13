import { MigrationInterface, QueryRunner } from "typeorm";

export class HostedDocs1791913785343 implements MigrationInterface {
    name = 'HostedDocs1791913785343'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "hosted_doc" ("id" SERIAL NOT NULL, "slug" citext NOT NULL, "notes" text NOT NULL DEFAULT '', "s3Key" character varying NOT NULL, "views" integer NOT NULL DEFAULT '0', "uploadedById" integer, "fileReplacedById" integer, "fileReplacedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_af3127b5967d10f64e13cbfff22" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2e2c14f634ce68564061b891ac" ON "hosted_doc" ("slug") WHERE "deletedAt" IS NULL`);
        await queryRunner.query(`ALTER TABLE "hosted_doc" ADD CONSTRAINT "FK_a836094dfac257e37b1af5d9ea3" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "hosted_doc" ADD CONSTRAINT "FK_18c0e4c52661d68bc394f312980" FOREIGN KEY ("fileReplacedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "hosted_doc" DROP CONSTRAINT "FK_18c0e4c52661d68bc394f312980"`);
        await queryRunner.query(`ALTER TABLE "hosted_doc" DROP CONSTRAINT "FK_a836094dfac257e37b1af5d9ea3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2e2c14f634ce68564061b891ac"`);
        await queryRunner.query(`DROP TABLE "hosted_doc"`);
    }

}
