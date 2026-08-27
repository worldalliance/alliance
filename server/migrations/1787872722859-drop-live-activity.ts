import { MigrationInterface, QueryRunner } from "typeorm";

export class DropLiveActivity1787872722859 implements MigrationInterface {
  name = "DropLiveActivity1787872722859";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_device" DROP COLUMN "liveActivityPushToStartToken"`,
    );
    await queryRunner.query(`DROP TABLE "live_activity_registration"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "live_activity_registration" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "actionId" integer NOT NULL,
        "updateToken" character varying,
        "activityId" character varying,
        "pushToStartSent" boolean NOT NULL DEFAULT false,
        "ended" boolean NOT NULL DEFAULT false,
        "lastCompletedCountSent" integer,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_live_activity_registration" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ae668abe22b44336fe57c35e86" ON "live_activity_registration" ("userId", "actionId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "live_activity_registration" ADD CONSTRAINT "FK_c052910fc3552b44cead5f3051a" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "live_activity_registration" ADD CONSTRAINT "FK_8c0d74e380efaeb42bd4c48d5ab" FOREIGN KEY ("actionId") REFERENCES "action"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_device" ADD "liveActivityPushToStartToken" character varying`,
    );
  }
}
