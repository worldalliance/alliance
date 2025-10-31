import { MigrationInterface, QueryRunner } from 'typeorm';

export class Suiteevents1761935029958 implements MigrationInterface {
  name = 'Suiteevents1761935029958';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "action_event" ADD "suiteManaged" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "action_event" DROP COLUMN "suiteManaged"`,
    );
  }
}
