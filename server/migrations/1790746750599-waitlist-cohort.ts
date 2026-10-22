import { MigrationInterface, QueryRunner } from "typeorm";

export class WaitlistCohort1790746750599 implements MigrationInterface {
    name = 'WaitlistCohort1790746750599'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "waitlist_cohort" ("id" SERIAL NOT NULL, "name" citext NOT NULL, "filter" jsonb NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_waitlist_cohort_name" CHECK ("name" ~ '[^[:space:]]'), CONSTRAINT "PK_cf0d20bdbdd36640b3c9a9ddf65" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_9d0bbf9841927360ccb23062f7" ON "waitlist_cohort" ("name") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_9d0bbf9841927360ccb23062f7"`);
        await queryRunner.query(`DROP TABLE "waitlist_cohort"`);
    }

}
