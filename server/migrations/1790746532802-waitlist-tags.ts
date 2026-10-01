import { MigrationInterface, QueryRunner } from "typeorm";

export class WaitlistTags1790746532802 implements MigrationInterface {
    name = 'WaitlistTags1790746532802'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "waitlist_tag" ("id" SERIAL NOT NULL, "name" citext NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_waitlist_tag_name" CHECK ("name" ~ '[^[:space:]]'), CONSTRAINT "PK_d4b0f725a683d6a60150a00613b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_55a2f3f5ea82d21f74c7df0fd9" ON "waitlist_tag" ("name") `);
        await queryRunner.query(`CREATE TABLE "waitlist_entry_tag" ("entryId" integer NOT NULL, "tagId" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f1df308397cb7aec5b44d8b17a2" PRIMARY KEY ("entryId", "tagId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bf2eefe65ab9fbf84b08066ff1" ON "waitlist_entry_tag" ("tagId") `);
        await queryRunner.query(`ALTER TABLE "waitlist_entry_tag" ADD CONSTRAINT "FK_f310ef30a70f170613562cdc4c3" FOREIGN KEY ("entryId") REFERENCES "waitlist_entry"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "waitlist_entry_tag" ADD CONSTRAINT "FK_bf2eefe65ab9fbf84b08066ff1e" FOREIGN KEY ("tagId") REFERENCES "waitlist_tag"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "waitlist_entry_tag" DROP CONSTRAINT "FK_bf2eefe65ab9fbf84b08066ff1e"`);
        await queryRunner.query(`ALTER TABLE "waitlist_entry_tag" DROP CONSTRAINT "FK_f310ef30a70f170613562cdc4c3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bf2eefe65ab9fbf84b08066ff1"`);
        await queryRunner.query(`DROP TABLE "waitlist_entry_tag"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_55a2f3f5ea82d21f74c7df0fd9"`);
        await queryRunner.query(`DROP TABLE "waitlist_tag"`);
    }

}
