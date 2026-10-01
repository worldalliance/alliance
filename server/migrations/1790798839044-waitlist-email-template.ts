import { MigrationInterface, QueryRunner } from "typeorm";

export class WaitlistEmailTemplate1790798839044 implements MigrationInterface {
    name = 'WaitlistEmailTemplate1790798839044'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "waitlist_email_template" ("id" SERIAL NOT NULL, "name" citext NOT NULL, "subject" character varying NOT NULL, "body" text NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_waitlist_email_template_name" CHECK ("name" ~ '[^[:space:]]'), CONSTRAINT "PK_c0f1173606e45ce58555eb7856c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b593a947464d9f6f06a47b9226" ON "waitlist_email_template" ("name") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_b593a947464d9f6f06a47b9226"`);
        await queryRunner.query(`DROP TABLE "waitlist_email_template"`);
    }

}
