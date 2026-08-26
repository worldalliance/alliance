import { MigrationInterface, QueryRunner } from "typeorm";

// Hand-written: the schema generator never emits DROP TABLE for an entity that
// is gone, so `migration:generate` reports no changes here.
//
// The table was dead, not merely unread: `createImage` had no callers anywhere,
// so no row was ever written. The upload endpoint returns the key and every
// reference lives in the answer or column that stored it.
//
// Nothing is lost here, but nothing is gained either. Reclaiming an upload that
// was never submitted still means diffing the bucket against every column that
// can hold a key, exactly as it did before. Object age is no help: a key only
// becomes referenced when the form is submitted, so an old object is as likely
// to be live as not.
export class DropImageTable1787691838691 implements MigrationInterface {
    name = 'DropImageTable1787691838691'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "image"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "image" ("id" SERIAL NOT NULL, "dateCreated" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "dateUpdated" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "key" character varying NOT NULL, "mime" character varying NOT NULL, "size" integer NOT NULL, CONSTRAINT "PK_d6db1ab4ee9ad9dbe86c64e4cc3" PRIMARY KEY ("id"))`);
    }

}
