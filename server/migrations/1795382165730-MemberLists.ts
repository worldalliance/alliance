import { MigrationInterface, QueryRunner } from "typeorm";

export class MemberLists1795382165730 implements MigrationInterface {
    name = 'MemberLists1795382165730'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "member_list_version" ("id" SERIAL NOT NULL, "listId" uuid NOT NULL, "savedById" integer, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e84f01cf6b50b16b430d5b9bc39" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4f289a39316aac2fcbe3a3ba82" ON "member_list_version" ("listId") `);
        await queryRunner.query(`CREATE TABLE "member_list" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_53a4dc2faf58e8ba2dc4a9fac61" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_member_list_name" ON "member_list" ("name") WHERE "deletedAt" IS NULL`);
        await queryRunner.query(`CREATE TABLE "member_list_member" ("versionId" integer NOT NULL, "userId" integer NOT NULL, CONSTRAINT "PK_bb52805e096defd793b682074ac" PRIMARY KEY ("versionId", "userId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_da1a8b2fbbf1f12e8782995e75" ON "member_list_member" ("userId") `);
        await queryRunner.query(`ALTER TABLE "member_list_version" ADD CONSTRAINT "FK_4f289a39316aac2fcbe3a3ba82c" FOREIGN KEY ("listId") REFERENCES "member_list"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "member_list_version" ADD CONSTRAINT "FK_f571202dc7a8a1e218389b33f6a" FOREIGN KEY ("savedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "member_list_member" ADD CONSTRAINT "FK_17e924e8e81083e8dcfe6e40d42" FOREIGN KEY ("versionId") REFERENCES "member_list_version"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "member_list_member" ADD CONSTRAINT "FK_da1a8b2fbbf1f12e8782995e759" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "member_list_member" DROP CONSTRAINT "FK_da1a8b2fbbf1f12e8782995e759"`);
        await queryRunner.query(`ALTER TABLE "member_list_member" DROP CONSTRAINT "FK_17e924e8e81083e8dcfe6e40d42"`);
        await queryRunner.query(`ALTER TABLE "member_list_version" DROP CONSTRAINT "FK_f571202dc7a8a1e218389b33f6a"`);
        await queryRunner.query(`ALTER TABLE "member_list_version" DROP CONSTRAINT "FK_4f289a39316aac2fcbe3a3ba82c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_da1a8b2fbbf1f12e8782995e75"`);
        await queryRunner.query(`DROP TABLE "member_list_member"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_member_list_name"`);
        await queryRunner.query(`DROP TABLE "member_list"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4f289a39316aac2fcbe3a3ba82"`);
        await queryRunner.query(`DROP TABLE "member_list_version"`);
    }

}
