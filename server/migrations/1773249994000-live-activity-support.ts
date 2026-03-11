import { MigrationInterface, QueryRunner } from 'typeorm';

export class LiveActivitySupport1773249994000 implements MigrationInterface {
  name = 'LiveActivitySupport1773249994000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add liveActivityPushToStartToken to user_device
    await queryRunner.query(
      `ALTER TABLE "user_device" ADD "liveActivityPushToStartToken" character varying`,
    );

    // Create live_activity_registration table
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

    // Add unique index on (userId, actionId)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_live_activity_registration_user_action" ON "live_activity_registration" ("userId", "actionId")`,
    );

    // Add foreign keys
    await queryRunner.query(
      `ALTER TABLE "live_activity_registration" ADD CONSTRAINT "FK_live_activity_registration_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "live_activity_registration" ADD CONSTRAINT "FK_live_activity_registration_action" FOREIGN KEY ("actionId") REFERENCES "action"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "live_activity_registration" DROP CONSTRAINT "FK_live_activity_registration_action"`,
    );
    await queryRunner.query(
      `ALTER TABLE "live_activity_registration" DROP CONSTRAINT "FK_live_activity_registration_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_live_activity_registration_user_action"`,
    );
    await queryRunner.query(`DROP TABLE "live_activity_registration"`);
    await queryRunner.query(
      `ALTER TABLE "user_device" DROP COLUMN "liveActivityPushToStartToken"`,
    );
  }
}
